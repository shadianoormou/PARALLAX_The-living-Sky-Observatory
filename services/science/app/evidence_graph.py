"""Evidence-chain assembly for a same-target, multi-band SPHEREx review.

This module deliberately keeps each band independent. A cross-band view is an
evidence index, not a new discovery score: a failed or low-quality band must
remain visible instead of being silently averaged away.
"""

from __future__ import annotations

from dataclasses import dataclass
from time import perf_counter
from typing import Any, Callable

from .adapters import ArchiveAdapterError, SpherexIrsaAdapter
from .pipeline import ObservationValidationError, analyze_observations


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


def _candidate_anchor(candidate: dict[str, Any], shape: tuple[int, int]) -> tuple[float, float] | None:
    """Return a normalized cutout position when the detector measured one."""

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
    return (float(position[0]) / width, float(position[1]) / height)


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
        matching = next((group for group in groups if anchor["band"] not in group["band_set"] and ((group["position"][0] - anchor["position"][0]) ** 2 + (group["position"][1] - anchor["position"][1]) ** 2) ** 0.5 <= 0.08), None)
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
            "position_normalized": [round(sum(item["position"][0] for item in group["candidates"]) / len(group["candidates"]), 4), round(sum(item["position"][1] for item in group["candidates"]) / len(group["candidates"]), 4)],
        }
        for index, group in enumerate(groups, start=1)
        if len(group["band_set"]) >= 2
    ]
    return {
        "status": "MULTI-BAND CONSISTENT" if matched_groups else "SINGLE-BAND ONLY",
        "matched_groups": matched_groups,
        "method": "Exploratory normalized cutout-position association within 8% of the cutout; not a WCS-confirmed source match.",
    }


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

    ra_deg = float(target["ra_deg"] % 360.0)
    dec_deg = float(target["dec_deg"])
    requested_bands = [band.strip() for band in bands if band.strip()]
    target_id = "target"
    nodes = [_node(target_id, "target", f"Sky target {ra_deg:.5f}, {dec_deg:.5f}", ra_deg=ra_deg, dec_deg=dec_deg)]
    edges: list[dict[str, Any]] = []
    results: list[dict[str, Any]] = []

    for index, band in enumerate(requested_bands, start=1):
        started = perf_counter()
        band_id = f"band:{index}:{band}"
        band_node = _node(band_id, "band", band, status="PENDING")
        nodes.append(band_node)
        edges.append(_edge(target_id, band_id, "queried", band=band))
        query = {
            "ra_deg": ra_deg,
            "dec_deg": dec_deg,
            "radius_deg": radius_deg,
            "collection": collection,
            "band": band,
            "cutout_size_deg": cutout_size_deg,
            "max_results": max_results,
        }
        try:
            adapter = adapter_factory(**query)
            pair = adapter.load_pair_with_records()
            analysis = analyze_observations(pair.epoch_a, pair.epoch_b)
            comparison = analysis["comparison"]
            status = comparison["status"]
            epochs = [record.observation_id for record in pair.records]
            candidates = analysis["candidates"]
            screened = analysis["screened_candidates"]
            shape = tuple(pair.epoch_a.image.shape)
            quality = {
                "valid_pixel_fraction": [
                    pair.epoch_a.metadata.get("valid_pixel_fraction"),
                    pair.epoch_b.metadata.get("valid_pixel_fraction"),
                ],
                "bad_pixel_fraction": [
                    pair.epoch_a.metadata.get("bad_pixel_fraction"),
                    pair.epoch_b.metadata.get("bad_pixel_fraction"),
                ],
                "registration_error": comparison.get("registration_error"),
                "sky_overlap_fraction": comparison.get("sky_overlap_fraction"),
            }
            result = {
                "band": band,
                "status": status,
                "query": query,
                "epochs": epochs,
                "candidate_count": len(candidates),
                "screened_count": len(screened),
                "quality": quality,
                "candidates": candidates,
                "screened_candidates": screened,
                "_anchors": [
                    {"band": band, "candidate_id": candidate.get("candidate_id", "candidate"), "position": anchor}
                    for candidate in candidates
                    if (anchor := _candidate_anchor(candidate, shape)) is not None
                ],
                "elapsed_seconds": round(perf_counter() - started, 3),
            }
            band_node["status"] = status
            epoch_ids: list[str] = []
            for epoch_index, epoch in enumerate(epochs):
                epoch_id = f"epoch:{index}:{epoch_index}"
                epoch_ids.append(epoch_id)
                nodes.append(_node(epoch_id, "epoch", f"{band} / epoch {epoch_index + 1}", observation_id=epoch))
                edges.append(_edge(band_id, epoch_id, "observed"))
            quality_id = f"quality:{index}"
            result_id = f"result:{index}"
            nodes.append(_node(quality_id, "quality", f"Quality gate: {status}", status=status, quality=quality))
            edges.append(_edge(band_id, quality_id, "guarded-by"))
            result_label = f"{len(candidates)} promoted candidate(s)" if candidates else "0 candidates / null result"
            nodes.append(_node(result_id, "result", result_label, candidate_count=len(candidates), screened_count=len(screened)))
            edges.append(_edge(band_id, result_id, "measured" if candidates else "no-promoted-residual"))
            for candidate_index, candidate in enumerate(candidates):
                candidate_id = f"candidate:{index}:{candidate_index}"
                nodes.append(_node(candidate_id, "candidate", candidate.get("candidate_id", f"candidate-{candidate_index + 1}"), classification=candidate.get("classification")))
                edges.append(_edge(result_id, candidate_id, "promoted"))
        except (ArchiveAdapterError, ObservationValidationError, ValueError) as error:
            status = "ERROR"
            result = {
                "band": band,
                "status": status,
                "query": query,
                "epochs": [],
                "candidate_count": 0,
                "screened_count": 0,
                "quality": {},
                "candidates": [],
                "screened_candidates": [],
                "_anchors": [],
                "elapsed_seconds": round(perf_counter() - started, 3),
                "error": str(error),
            }
            band_node["status"] = status
            error_id = f"error:{index}"
            nodes.append(_node(error_id, "error", f"Archive error: {error}"))
            edges.append(_edge(band_id, error_id, "failed"))
        results.append(result)

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
