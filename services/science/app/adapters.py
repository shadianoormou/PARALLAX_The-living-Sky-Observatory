"""Observation adapters for synthetic and public astronomy data.

The synthetic adapter is deterministic and remains useful for regression tests.
``SpherexIrsaAdapter`` is the real-data boundary: it discovers public SPHEREx
spectral-image products through IRSA's SIA service, requests small FITS
cutouts, and attaches enough provenance to make an analysis reproducible.
"""

from __future__ import annotations

import csv
import hashlib
import io
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Protocol
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

import httpx
import numpy as np
from astropy.io import fits

from .synthetic import Observation, generate_synthetic_dataset


class ArchiveAdapterError(RuntimeError):
    """Raised when an archive query or product cannot be used safely."""


class ObservationPairAdapter(Protocol):
    source_name: str

    def load_pair(self) -> tuple[Observation, Observation]:
        """Load two observations with validated metadata."""


@dataclass(frozen=True)
class SpherexRecord:
    """A normalized row returned by IRSA's SIA service."""

    observation_id: str
    band: str
    access_url: str
    ra_deg: float
    dec_deg: float
    pixel_scale_arcsec: float
    t_min_mjd: float
    t_max_mjd: float
    em_min_um: float | None
    em_max_um: float | None
    obs_release_date: str | None
    source_row: dict[str, str]


@dataclass(frozen=True)
class SpherexPair:
    epoch_a: Observation
    epoch_b: Observation
    records: tuple[SpherexRecord, SpherexRecord]


def image_preview(image: np.ndarray, max_side: int = 256) -> dict[str, Any]:
    """Return a bounded display-only grayscale preview, never scientific data."""

    stride = max(1, int(np.ceil(max(image.shape) / max_side)))
    sampled = image[::stride, ::stride].astype(np.float64)
    finite = sampled[np.isfinite(sampled)]
    if finite.size == 0:
        scaled = np.zeros(sampled.shape, dtype=np.uint8)
        low, high = 0.0, 0.0
    else:
        low, high = np.percentile(finite, [1.0, 99.0])
        if high <= low:
            high = low + 1.0
        scaled = np.clip((sampled - low) / (high - low) * 255.0, 0, 255).astype(np.uint8)
    return {
        "width": int(scaled.shape[1]),
        "height": int(scaled.shape[0]),
        "pixels": scaled.reshape(-1).tolist(),
        "display_min": float(low),
        "display_max": float(high),
        "stride": stride,
    }


class SyntheticDemoAdapter:
    source_name = "parallax-synthetic-v1"

    def __init__(self, seed: int = 2026, background_sigma: float = 1.0) -> None:
        self.seed = seed
        self.background_sigma = background_sigma

    def load_pair(self) -> tuple[Observation, Observation]:
        dataset = generate_synthetic_dataset(seed=self.seed, background_sigma=self.background_sigma)
        return dataset.epoch_a, dataset.epoch_b


class SpherexIrsaAdapter:
    """Discover and load a same-band pair of real SPHEREx archive cutouts.

    Discovery uses IRSA's SIA service. The adapter only downloads access URLs
    returned by IRSA and only permits the IRSA host. Cutouts keep the browser
    path practical while preserving the original access URL and exact query.
    """

    source_name = "NASA SPHEREx / IRSA"
    sia_endpoint = "https://irsa.ipac.caltech.edu/SIA"
    allowed_hosts = {"irsa.ipac.caltech.edu"}

    def __init__(
        self,
        ra_deg: float,
        dec_deg: float,
        radius_deg: float = 0.01,
        *,
        collection: str = "spherex_qr2",
        band: str | None = None,
        cutout_size_deg: float = 0.1,
        max_results: int = 50,
        timeout_seconds: float = 60.0,
        cache_dir: str | Path | None = None,
        client: httpx.Client | None = None,
    ) -> None:
        if not -360.0 <= ra_deg <= 360.0:
            raise ValueError("ra_deg must be between -360 and 360")
        if not -90.0 <= dec_deg <= 90.0:
            raise ValueError("dec_deg must be between -90 and 90")
        if not 0.0001 <= radius_deg <= 2.0:
            raise ValueError("radius_deg must be between 0.0001 and 2 degrees")
        if not 0.01 <= cutout_size_deg <= 1.0:
            raise ValueError("cutout_size_deg must be between 0.01 and 1 degree")
        if not 2 <= max_results <= 200:
            raise ValueError("max_results must be between 2 and 200")
        self.ra_deg = float(ra_deg % 360.0)
        self.dec_deg = float(dec_deg)
        self.radius_deg = float(radius_deg)
        self.collection = collection.strip()
        self.band = band.strip() if band else None
        self.cutout_size_deg = float(cutout_size_deg)
        self.max_results = int(max_results)
        self.timeout_seconds = float(timeout_seconds)
        self.cache_dir = Path(cache_dir) if cache_dir else None
        self._client = client

    def _http_client(self) -> httpx.Client:
        return self._client or httpx.Client(
            timeout=httpx.Timeout(self.timeout_seconds, connect=min(15.0, self.timeout_seconds)),
            follow_redirects=True,
            headers={"User-Agent": "PARALLAX/0.3 (scientific demo)"},
        )

    def query_records(self) -> list[SpherexRecord]:
        params = {
            "COLLECTION": self.collection,
            "POS": f"circle {self.ra_deg:.8f} {self.dec_deg:.8f} {self.radius_deg:.8f}",
            "RESPONSEFORMAT": "CSV",
            "MAXREC": str(self.max_results),
        }
        client = self._http_client()
        owns_client = client is not self._client
        try:
            for attempt in range(3):
                try:
                    response = client.get(self.sia_endpoint, params=params)
                    response.raise_for_status()
                    break
                except httpx.HTTPStatusError as error:
                    if error.response.status_code in {502, 503, 504} and attempt < 2:
                        time.sleep(attempt + 1)
                        continue
                    raise ArchiveAdapterError(f"IRSA SIA query failed: {error}") from error
                except httpx.HTTPError as error:
                    raise ArchiveAdapterError(f"IRSA SIA query failed: {error}") from error
        finally:
            if owns_client:
                client.close()

        try:
            rows = list(csv.DictReader(io.StringIO(response.text)))
        except csv.Error as error:
            raise ArchiveAdapterError("IRSA returned an unreadable SIA CSV response.") from error
        if not rows:
            raise ArchiveAdapterError("IRSA returned no SPHEREx images for this sky position.")

        records: list[SpherexRecord] = []
        for row in rows[: self.max_results]:
            try:
                access_url = row.get("access_url", "").strip()
                parsed = urlparse(access_url)
                if parsed.scheme != "https" or parsed.hostname not in self.allowed_hosts:
                    continue
                records.append(SpherexRecord(
                    observation_id=row["obs_id"].strip(),
                    band=row.get("energy_bandpassname", "").strip(),
                    access_url=access_url,
                    ra_deg=float(row["s_ra"]),
                    dec_deg=float(row["s_dec"]),
                    pixel_scale_arcsec=float(row["s_pixel_scale"]),
                    t_min_mjd=float(row["t_min"]),
                    t_max_mjd=float(row["t_max"]),
                    em_min_um=float(row["em_min"]) * 1e6 if row.get("em_min") else None,
                    em_max_um=float(row["em_max"]) * 1e6 if row.get("em_max") else None,
                    obs_release_date=row.get("obs_release_date") or None,
                    source_row=dict(row),
                ))
            except (KeyError, TypeError, ValueError):
                continue
        if not records:
            raise ArchiveAdapterError("IRSA returned no safe FITS access URLs with usable metadata.")
        return records

    def select_pair(self, records: list[SpherexRecord] | None = None) -> tuple[SpherexRecord, SpherexRecord]:
        """Select earliest/latest distinct observation in one band."""

        available = records or self.query_records()
        groups: dict[str, list[SpherexRecord]] = {}
        for record in available:
            if self.band and record.band.lower() != self.band.lower():
                continue
            groups.setdefault(record.band, []).append(record)
        candidates = max(groups.values(), key=len, default=[])
        if len({record.observation_id for record in candidates}) < 2:
            requested = f" for band {self.band}" if self.band else ""
            raise ArchiveAdapterError(f"IRSA did not return two distinct epochs{requested}.")
        by_time: dict[str, SpherexRecord] = {}
        for record in sorted(candidates, key=lambda item: item.t_min_mjd):
            by_time.setdefault(record.observation_id, record)
        distinct = list(by_time.values())
        return distinct[0], distinct[-1]

    def load_pair(self) -> tuple[Observation, Observation]:
        pair = self.load_pair_with_records()
        return pair.epoch_a, pair.epoch_b

    def load_pair_with_records(self) -> SpherexPair:
        records = self.select_pair()
        return SpherexPair(
            epoch_a=self._load_record(records[0], "A"),
            epoch_b=self._load_record(records[1], "B"),
            records=records,
        )

    def _cutout_url(self, access_url: str) -> str:
        parsed = urlparse(access_url)
        if parsed.scheme != "https" or parsed.hostname not in self.allowed_hosts:
            raise ArchiveAdapterError("The archive returned a non-IRSA FITS URL; refusing to download it.")
        query = {key: values[-1] for key, values in parse_qs(parsed.query).items()}
        query.update({"center": f"{self.ra_deg:.8f},{self.dec_deg:.8f}", "size": f"{self.cutout_size_deg:.8f}"})
        return urlunparse(parsed._replace(query=urlencode(query)))

    def _load_record(self, record: SpherexRecord, epoch: str) -> Observation:
        cutout_url = self._cutout_url(record.access_url)
        payload, retrieval_timestamp, checksum = self._download(cutout_url)
        try:
            image, flags, variance, header = self._read_fits(payload)
        except (OSError, ValueError) as error:
            raise ArchiveAdapterError(f"SPHEREx FITS product {record.observation_id} could not be read: {error}") from error
        finite = np.isfinite(image)
        invalid_count = int(image.size - int(np.count_nonzero(finite)))
        if invalid_count:
            replacement = float(np.nanmedian(image)) if np.any(finite) else 0.0
            image = np.nan_to_num(image, nan=replacement, posinf=replacement, neginf=replacement)
        flagged_fraction = float(np.count_nonzero(flags)) / float(flags.size) if flags is not None else None
        # SPHEREx bit 21 (2097152) is the nominal/source-mask state and is not
        # itself a bad-pixel condition. Preserve raw coverage, but only expose
        # bits outside that nominal state to Comparison Guard as bad pixels.
        bad_fraction = None
        if flags is not None:
            non_nominal = np.bitwise_and(flags.astype(np.int64), ~np.int64(1 << 21))
            bad_fraction = float(np.count_nonzero(non_nominal)) / float(flags.size)
        variance_median = float(np.nanmedian(variance)) if variance is not None else None
        metadata: dict[str, Any] = {
            "dataset_label": f"SPHEREx {self.collection.upper()} · IRSA ARCHIVE",
            "dataset_id": self.collection,
            "dataset_source": "NASA/IPAC Infrared Science Archive",
            "source_type": "real NASA mission archive observation",
            "source_identifier": record.observation_id,
            "source_url": record.access_url,
            "cutout_url": cutout_url,
            "retrieved_at_utc": retrieval_timestamp,
            "checksum_sha256": checksum,
            "collection": self.collection,
            "release_date": record.obs_release_date,
            "epoch": epoch,
            "observation_id": record.observation_id,
            "capture_time_mjd": record.t_min_mjd,
            "capture_time_end_mjd": record.t_max_mjd,
            "shape": list(image.shape),
            "coordinate_frame": header.get("RADESYS", "ICRS"),
            "pixel_scale_arcsec": record.pixel_scale_arcsec,
            "bands": [record.band] if record.band else [],
            "wavelength_um": [record.em_min_um, record.em_max_um],
            "sky_overlap_fraction": 1.0,
            "cutout_center_ra_deg": self.ra_deg,
            "cutout_center_dec_deg": self.dec_deg,
            "cutout_size_deg": self.cutout_size_deg,
            "image_unit": header.get("BUNIT", "unknown"),
            "invalid_pixel_count": invalid_count,
            "invalid_pixel_fraction": invalid_count / float(image.size),
            "flagged_pixel_fraction": flagged_fraction,
            "bad_pixel_fraction": bad_fraction,
            "median_variance": variance_median,
            "quality_flags_present": flags is not None,
            "wcs": {key: header[key] for key in ("CTYPE1", "CTYPE2", "CRVAL1", "CRVAL2") if key in header},
            "provenance_status": "real SPHEREx archive cutout; source and retrieval metadata preserved",
        }
        return Observation(image.astype(np.float32), metadata, {})

    def _download(self, url: str) -> tuple[bytes, str, str]:
        cache_path = self._cache_path(url)
        if cache_path and cache_path.exists():
            payload = cache_path.read_bytes()
            timestamp = datetime.fromtimestamp(cache_path.stat().st_mtime, timezone.utc).isoformat()
        else:
            client = self._http_client()
            owns_client = client is not self._client
            try:
                try:
                    with client.stream("GET", url) as response:
                        response.raise_for_status()
                        content_length = int(response.headers.get("content-length", "0") or 0)
                        if content_length > 32 * 1024 * 1024:
                            raise ArchiveAdapterError("SPHEREx cutout exceeds the 32 MB safety limit.")
                        chunks: list[bytes] = []
                        size = 0
                        for chunk in response.iter_bytes():
                            size += len(chunk)
                            if size > 32 * 1024 * 1024:
                                raise ArchiveAdapterError("SPHEREx cutout exceeds the 32 MB safety limit.")
                            chunks.append(chunk)
                        payload = b"".join(chunks)
                except httpx.HTTPError as error:
                    raise ArchiveAdapterError(f"SPHEREx cutout download failed: {error}") from error
                timestamp = datetime.now(timezone.utc).isoformat()
            finally:
                if owns_client:
                    client.close()
            if cache_path:
                cache_path.parent.mkdir(parents=True, exist_ok=True)
                cache_path.write_bytes(payload)
        return payload, timestamp, hashlib.sha256(payload).hexdigest()

    def _cache_path(self, url: str) -> Path | None:
        if self.cache_dir is None:
            return None
        return self.cache_dir / f"{hashlib.sha256(url.encode('utf-8')).hexdigest()}.fits"

    @staticmethod
    def _read_fits(payload: bytes) -> tuple[np.ndarray, np.ndarray | None, np.ndarray | None, fits.Header]:
        with fits.open(io.BytesIO(payload), memmap=False, mode="readonly") as hdul:
            image_hdu = hdul["IMAGE"] if "IMAGE" in hdul else next((hdu for hdu in hdul if hdu.data is not None and np.ndim(hdu.data) == 2), None)
            if image_hdu is None or image_hdu.data is None:
                raise ValueError("no 2D IMAGE extension was found")
            image = np.asarray(image_hdu.data, dtype=np.float32)
            flags_hdu = hdul["FLAGS"] if "FLAGS" in hdul else None
            variance_hdu = hdul["VARIANCE"] if "VARIANCE" in hdul else None
            flags = np.asarray(flags_hdu.data) if flags_hdu is not None and flags_hdu.data is not None else None
            variance = np.asarray(variance_hdu.data, dtype=np.float32) if variance_hdu is not None and variance_hdu.data is not None else None
            return image, flags, variance, image_hdu.header.copy()

    def provenance_manifest(self, pair: SpherexPair) -> dict[str, Any]:
        return {
            "adapter": self.source_name,
            "sia_endpoint": self.sia_endpoint,
            "query": {
                "collection": self.collection,
                "ra_deg": self.ra_deg,
                "dec_deg": self.dec_deg,
                "radius_deg": self.radius_deg,
                "band": self.band,
                "cutout_size_deg": self.cutout_size_deg,
            },
            "records": [record.source_row for record in pair.records],
            "epochs": [pair.epoch_a.metadata, pair.epoch_b.metadata],
        }


class FutureArchiveAdapter:
    """Compatibility alias retained for callers that used the old placeholder."""

    source_name = "future-archive-adapter"

    def load_pair(self) -> tuple[Observation, Observation]:
        raise NotImplementedError(
            "Use SpherexIrsaAdapter with a verified coordinate query to load real observations."
        )
