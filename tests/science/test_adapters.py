from __future__ import annotations

import csv
import io

import httpx
import numpy as np
from astropy.io import fits

from services.science.app.adapters import SpherexIrsaAdapter


def _fits_bytes() -> bytes:
    stream = io.BytesIO()
    primary = fits.PrimaryHDU()
    image = fits.ImageHDU(np.arange(16, dtype=np.float32).reshape(4, 4), name="IMAGE")
    image.header["BUNIT"] = "MJy / sr"
    image.header["RADESYS"] = "ICRS"
    image.header["CTYPE1"] = "RA---TAN-SIP"
    image.header["CTYPE2"] = "DEC--TAN-SIP"
    image.header["CRVAL1"] = 127.0
    image.header["CRVAL2"] = -39.0
    flags = fits.ImageHDU(np.zeros((4, 4), dtype=np.int32), name="FLAGS")
    flags.data[0, 0] = 1
    variance = fits.ImageHDU(np.ones((4, 4), dtype=np.float32), name="VARIANCE")
    fits.HDUList([primary, image, flags, variance]).writeto(stream)
    return stream.getvalue()


def _sia_csv() -> str:
    fields = ["s_ra", "s_dec", "s_pixel_scale", "obs_id", "t_min", "t_max", "em_min", "em_max", "energy_bandpassname", "access_url", "obs_release_date"]
    rows = [
        [127, -39, 6.15, "2025W20_2D_0192_2", 60811.64, 60811.65, 1.63e-6, 2.43e-6, "SPHEREx-D3", "https://irsa.ipac.caltech.edu/a.fits", "2025-10-17"],
        [127, -39, 6.15, "2025W51_1A_0150_1", 61024.66, 61024.67, 1.63e-6, 2.43e-6, "SPHEREx-D3", "https://irsa.ipac.caltech.edu/b.fits", "2026-01-27"],
    ]
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(fields)
    writer.writerows(rows)
    return output.getvalue()


def test_spherex_adapter_discovers_and_loads_provenance_backed_pair() -> None:
    payload = _fits_bytes()

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/SIA"):
            return httpx.Response(200, text=_sia_csv(), request=request)
        return httpx.Response(200, content=payload, request=request)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    adapter = SpherexIrsaAdapter(127.0, -39.0, band="SPHEREx-D3", client=client)

    pair = adapter.load_pair_with_records()

    assert [record.observation_id for record in pair.records] == ["2025W20_2D_0192_2", "2025W51_1A_0150_1"]
    assert pair.epoch_a.image.shape == (4, 4)
    assert pair.epoch_a.metadata["dataset_source"] == "NASA/IPAC Infrared Science Archive"
    assert pair.epoch_a.metadata["source_url"].endswith("a.fits")
    assert pair.epoch_a.metadata["cutout_url"].endswith("center=127.00000000%2C-39.00000000&size=0.10000000")
    assert len(pair.epoch_a.metadata["checksum_sha256"]) == 64
    assert pair.epoch_a.metadata["bad_pixel_fraction"] == 1 / 16
    assert pair.epoch_a.metadata["valid_pixel_fraction"] == 15 / 16
    assert pair.epoch_a.flags is not None and pair.epoch_a.variance is not None
    assert adapter.provenance_manifest(pair)["query"]["collection"] == "spherex_qr2"

    client.close()


def test_spherex_adapter_rejects_non_irsa_download_urls() -> None:
    adapter = SpherexIrsaAdapter(127.0, -39.0)
    try:
        adapter._cutout_url("https://example.com/not-an-irsa-product.fits")
    except RuntimeError as error:
        assert "non-IRSA" in str(error)
    else:
        raise AssertionError("unsafe archive URL was accepted")


def test_nominal_spherex_source_mask_is_not_treated_as_bad_pixel() -> None:
    payload = _fits_bytes()
    with fits.open(io.BytesIO(payload), mode="update", memmap=False) as hdul:
        hdul["FLAGS"].data[:, :] = 1 << 21
        stream = io.BytesIO()
        hdul.writeto(stream)
        payload = stream.getvalue()

    image, flags, variance, _ = SpherexIrsaAdapter._read_fits(payload)
    assert image.shape == (4, 4)
    assert flags is not None and variance is not None
    assert np.count_nonzero(np.bitwise_and(flags.astype(np.int64), ~np.int64(1 << 21))) == 0
