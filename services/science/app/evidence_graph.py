"""Evidence-chain assembly for a same-target, multi-band SPHEREx review.

This module deliberately keeps each band independent. A cross-band view is an
evidence index, not a new discovery score: a failed or low-quality band must
remain visible instead of being silently averaged away.
"""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor
from threading import RLock
from time import perf_counter, monotonic
from typing import Any, Callable

from astropy.io.fits import Header
from astropy.wcs import WCS

from .adapters import ArchiveAdapterError, SpherexIrsaAdapter
from .pipeline import ObservationValidationError, analyze_observations


_EVIDENCE_CACHE: dict[tuple[tuple[str, Any], ...], tuple[float, dict[str, Any]]] = {}
_EVIDENCE_CACHE_LOCK = RLock()
_EVIDENCE_CACHE_TTL_SECONDS = 180.0


@dataclass(frozen=True)
class SpherexEvidenceBand:
    band: str
    ra_deg: float
    dec_deg: float
    radius_deg: float = 0.001
    collection: str = "spherex_qr2"
    cutout_size_deg: float = 0.03
    max_results: int = 20


def _node(node_id: str, node_type: str, label: str, **extra: Any) -> dict[str, Any]:
    return {"id": node_id, "type": node_type, "label": label, **extra}


def _edge(source: str, target: str, relation: str, **extra: Any) -> dict[str, Any]:
    return {"from": source, "to": target, "relation": relation, **extra}


def _candidate_anchor(candidate: dict[str, Any], metadata: dict[str, Any], shape: tuple[int, int]) -> dict[str, Any] | None:
    """Return a WCS sky position when available, otherwise a pixel fallback."""

    measurement = candidate.get("measurement", {})
    position = measurement.get("position_xy")
    if position is None and measurement.get("position_a_xy") and measurement.get("position_b_xy"):
        first = measurement["position_a_xy"]
        second = measurement["position_b_xy"]
        position = [(float(first[0]) + float(second[0])) / 2, (float(first[1]) + float(second[1])) / 2]
    if not isinstance(position, list) or len(position) != 2 or not all(isinstance(value, (int, float)) for value in position):
        return None
    height, width = shape
    if width <= 0 or height <= 0:
        return None
    normalized = (float(position[0]) / width, float(position[1]) / height)
    anchor: dict[str, Any] = {"position": normalized, "coordinate_mode": "pixel-fallback"}
    wcs_values = metadata.get("wcs")
    if isinstance(wcs_values, dict) and {"CTYPE1", "CTYPE2", "CRVAL1", "CRVAL2", "CRPIX1", "CRPIX2"}.issubset(wcs_values):
        try:
            header = Header()
            for key, value in wcs_values.items():
                header[key] = value
            world = WCS(header).pixel_to_world_values(float(position[0]), float(position[1]))
            anchor["world_position"] = [float(world[0] % 360.0), float(world[1])]
            anchor["coordinate_mode"] = "wcs"
        except (ValueError, TypeError, KeyError):
            pass
    return anchor


def _cross_band_consistency(results: list[dict[str, Any]]) -> dict[str, Any]:
    """Associate measured residuals by normalized cutout position, cautiously."""

    anchors = [anchor for result in results for anchor in result.get("_anchors", [])]
    if not anchors:
        return {
            "status": "NO PROMOTED CANDIDATES",
            "matched_groups": [],
            "method": "No promoted residuals were available for a cross-band position check.",
        }
    groups: list[dict[str, Any]] = []
    for anchor in anchors:
        def close_enough(group: dict[str, Any]) -> bool:
            if anchor["band"] in group["band_set"]:
                return False
            reference = group["candidates"][0]
            if anchor["coordinate_mode"] == "wcs" and reference["coordinate_mode"] == "wcs":
                ra_delta = abs(anchor["world_position"][0] - reference["world_position"][0])
                ra_delta = min(ra_delta, 360.0 - ra_delta)
                dec_delta = abs(anchor["world_position"][1] - reference["world_position"][1])
                return (ra_delta**2 + dec_delta**2) ** 0.5 <= 0.002
            return anchor["coordinate_mode"] == reference["coordinate_mode"] == "pixel-fallback" and ((group["position"][0] - anchor["position"][0]) ** 2 + (group["position"][1] - anchor["position"][1]) ** 2) ** 0.5 <= 0.08

        matching = next((group for group in groups if close_enough(group)), None)
        if matching is None:
            groups.append({"band_set": {anchor["band"]}, "position": anchor["position"], "candidates": [anchor]})
        elif anchor["band"] not in matching["band_set"]:
            matching["band_set"].add(anchor["band"])
            matching["candidates"].append(anchor)
    matched_groups = [
        {
            "group_id": f"cross-band-{index}",
            "bands": sorted(group["band_set"]),
            "candidate_ids": [item["candidate_id"] for item in group["candidates"]],
            "coordinate_mode": group["candidates"][0]["coordinate_mode"],
            "position_normalized": [round(sum(item["position"][0] for item in group["candidates"]) / len(group["candidates"]), 4), round(sum(item["position"][1] for item in group["candidates"]) / len(group["candidates"]), 4)],
        }
        for index, group in enumerate(groups, start=1)
        if len(group["band_set"]) >= 2
    ]
    return {
        "status": ("MULTI-BAND WCS CONSISTENT" if any(group["coordinate_mode"] == "wcs" for group in matched_groups) else "MULTI-BAND PIXEL-ALIGNED") if matched_groups else "SINGLE-BAND ONLY",
        "matched_groups": matched_groups,
        "method": "WCS sky-coordinate association within 0.002 degrees when archive WCS is complete; otherwise normalized cutout-position association within 8%. Pixel fallback is not WCS-confirmed.",
    }


def _run_band_analysis(
    band: str,
    query: dict[str, Any],
    adapter_factory: Callable[..., SpherexIrsaAdapter],
) -> dict[str, Any]:
    """Analyze one band, using a short-lived metadata cache for repeated judge runs."""

    cache_enabled = adapter_factory is SpherexIrsaAdapter
    cache_key = tuple(sorted(query.items()))
    now = monotonic()
    if cache_enabled:
        with _EVIDENCE_CACHE_LOCK:
            cached = _EVIDENCE_CACHE.get(cache_key)
            if cached and now - cached[0] < _EVIDENCE_CACHE_TTL_SECONDS:
                result = deepcopy(cached[1])
                result["cache_hit"] = True
                result["elapsed_seconds"] = 0.0
                return result

    started = perf_counter()
    try:
        adapter = adapter_factory(**query)
        pair = adapter.load_pair_with_records()
        analysis = analyze_observations(pair.epoch_a, pair.epoch_b)
        comparison = analysis["comparison"]
        candidates = analysis["candidates"]
        shape = tuple(pair.epoch_a.image.shape)
        result = {
            "band": band,
            "status": comparison["status"],
            "query": query,
            "epochs": [record.observation_id for record in pair.records],
            "candidate_count": len(candidates),
            "screened_count": len(analysis["screened_candidates"]),
            "quality": {
                "valid_pixel_fraction": [pair.epoch_a.metadata.get("valid_pixel_fraction"), pair.epoch_b.metadata.get("valid_pixel_fraction")],
                "bad_pixel_fraction": [pair.epoch_a.metadata.get("bad_pixel_fraction"), pair.epoch_b.metadata.get("bad_pixel_fraction")],
                "registration_error": comparison.get("registration_error"),
                "sky_overlap_fraction": comparison.get("sky_overlap_fraction"),
            },
            "candidates": candidates,
            "screened_candidates": analysis["screened_candidates"],
            "_anchors": [
                {"band": band, "candidate_id": candidate.get("candidate_id", "candidate"), **anchor}
                for candidate in candidates
                if (anchor := _candidate_anchor(candidate, pair.epoch_a.metadata, shape)) is not None
            ],
            "elapsed_seconds": round(perf_counter() - started, 3),
            "cache_hit": False,
        }
    except (ArchiveAdapterError, ObservationValidationError, ValueError) as error:
        result = {
            "band": band,
            "status": "ERROR",
            "query": query,
            "epochs": [],
            "candidate_count": 0,
            "screened_count": 0,
            "quality": {},
            "candidates": [],
            "screened_candidates": [],
            "_anchors": [],
            "elapsed_seconds": round(perf_counter() - started, 3),
            "cache_hit": False,
            "error": str(error),
        }
    if cache_enabled and result["status"] != "ERROR":
        with _EVIDENCE_CACHE_LOCK:
            _EVIDENCE_CACHE[cache_key] = (monotonic(), deepcopy(result))
    return result


def build_spherex_evidence_graph(
    target: dict[str, float],
    bands: list[str],
    *,
    radius_deg: float = 0.001,
    collection: str = "spherex_qr2",
    cutout_size_deg: float = 0.03,
    max_results: int = 20,
    adapter_factory: Callable[..., SpherexIrsaAdapter] = SpherexIrsaAdapter,
) -> dict[str, Any]:
    """Build a provenance-preserving graph of independent band analyses."""

    started = perf_counter()
    ra_deg = float(target["ra_deg"] % 360.0)
    dec_deg = float(target["dec_deg"])
    requested_bands = [band.strip() for band in bands if band.strip()]
    target_id = "target"
    nodes = [_node(target_id, "target", f"Sky target {ra_deg:.5f}, {dec_deg:.5f}", ra_deg=ra_deg, dec_deg=dec_deg)]
    edges: list[dict[str, Any]] = []
    results: list[dict[str, Any]] = []

    queries = [
        (band, {"ra_deg": ra_deg, "dec_deg": dec_deg, "radius_deg": radius_deg, "collection": collection, "band": band, "cutout_size_deg": cutout_size_deg, "max_results": max_results})
        for band in requested_bands
    ]
    worker_count = min(6, max(1, len(queries)))
    with ThreadPoolExecutor(max_workers=worker_count) as executor:
        results = list(executor.map(lambda item: _run_band_analysis(item[0], item[1], adapter_factory), queries))

    for index, result in enumerate(results, start=1):
        band = result["band"]
        status = result["status"]
        band_id = f"band:{index}:{band}"
        band_node = _node(band_id, "band", band, status=status, cache_hit=result.get("cache_hit", False))
        nodes.append(band_node)
        edges.append(_edge(target_id, band_id, "queried", band=band))
        if status == "ERROR":
            error_id = f"error:{index}"
            nodes.append(_node(error_id, "error", f"Archive error: {result.get('error', 'unknown error')}"))
            edges.append(_edge(band_id, error_id, "failed"))
            continue
        for epoch_index, epoch in enumerate(result["epochs"]):
            epoch_id = f"epoch:{index}:{epoch_index}"
            nodes.append(_node(epoch_id, "epoch", f"{band} / epoch {epoch_index + 1}", observation_id=epoch))
            edges.append(_edge(band_id, epoch_id, "observed"))
        quality_id = f"quality:{index}"
        result_id = f"result:{index}"
        nodes.append(_node(quality_id, "quality", f"Quality gate: {status}", status=status, quality=result["quality"]))
        edges.append(_edge(band_id, quality_id, "guarded-by"))
        nodes.append(_node(result_id, "result", f"{result['candidate_count']} promoted candidate(s)" if result["candidate_count"] else "0 candidates / null result", candidate_count=result["candidate_count"], screened_count=result["screened_count"]))
        edges.append(_edge(band_id, result_id, "measured" if result["candidate_count"] else "no-promoted-residual"))
        for candidate_index, candidate in enumerate(result["candidates"]):
            candidate_id = f"candidate:{index}:{candidate_index}"
            nodes.append(_node(candidate_id, "candidate", candidate.get("candidate_id", f"candidate-{candidate_index + 1}"), classification=candidate.get("classification")))
            edges.append(_edge(result_id, candidate_id, "promoted"))

    ready = sum(item["status"] == "READY TO COMPARE" for item in results)
    caution = sum(item["status"] == "COMPARE WITH CAUTION" for item in results)
    blocked = sum(item["status"] == "COMPARISON NOT RELIABLE" for item in results)
    errors = sum(item["status"] == "ERROR" for item in results)
    candidate_count = sum(item["candidate_count"] for item in results)
    consistency = _cross_band_consistency(results)
    for result in results:
        result.pop("_anchors", None)
    return {
        "suite": "PARALLAX X SPHEREx Evidence Graph",
        "mode": "real archive data",
        "target": {"ra_deg": ra_deg, "dec_deg": dec_deg},
        "summary": {
            "bands_requested": len(results),
            "bands_ready": ready,
            "bands_caution": caution,
            "bands_blocked": blocked,
            "bands_error": errors,
            "total_candidates": candidate_count,
            "bands_with_candidates": sum(item["candidate_count"] > 0 for item in results),
            "consistency_status": consistency["status"],
            "matched_candidate_groups": len(consistency["matched_groups"]),
            "processing_mode": "parallel per-band analysis with 180-second metadata cache",
            "elapsed_seconds": round(perf_counter() - started, 3),
            "slowest_band_seconds": round(max((item["elapsed_seconds"] for item in results), default=0.0), 3),
            "cache_hits": sum(bool(item.get("cache_hit")) for item in results),
        },
        "bands": results,
        "cross_band_consistency": consistency,
        "graph": {"nodes": nodes, "edges": edges},
        "limitations": [
            "Bands are analyzed independently; cross-band agreement is evidence context, not a discovery probability.",
            "A null result means no residual passed this workflow in the requested cutout, not that the sky is empty.",
            "Archive coverage, flags, registration quality, and network availability can change the result.",
            "Any promoted candidate remains provisional and requires independent verification.",
        ],
    }
