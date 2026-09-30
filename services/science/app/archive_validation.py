"""Repeatable live-data validation across independent SPHEREx sky fields."""

from __future__ import annotations

from dataclasses import dataclass
from time import perf_counter
from typing import Any, Callable

from .adapters import ArchiveAdapterError, SpherexIrsaAdapter
from .pipeline import ObservationValidationError, analyze_observations


@dataclass(frozen=True)
class SpherexValidationField:
    label: str
    ra_deg: float
    dec_deg: float
    radius_deg: float = 0.001
    collection: str = "spherex_qr2"
    band: str | None = "SPHEREx-D3"
    cutout_size_deg: float = 0.03
    max_results: int = 20


def validate_spherex_fields(
    fields: list[SpherexValidationField],
    adapter_factory: Callable[..., SpherexIrsaAdapter] = SpherexIrsaAdapter,
) -> dict[str, Any]:
    """Analyze each requested field independently and preserve failures as evidence."""

    results: list[dict[str, Any]] = []
    for field in fields:
        started = perf_counter()
        query = {
            "ra_deg": field.ra_deg,
            "dec_deg": field.dec_deg,
            "radius_deg": field.radius_deg,
            "collection": field.collection,
            "band": field.band,
            "cutout_size_deg": field.cutout_size_deg,
            "max_results": field.max_results,
        }
        try:
            adapter = adapter_factory(**query)
            pair = adapter.load_pair_with_records()
            analysis = analyze_observations(pair.epoch_a, pair.epoch_b)
            results.append({
                "label": field.label,
                "status": analysis["comparison"]["status"],
                "query": query,
                "epochs": [record.observation_id for record in pair.records],
                "candidate_count": len(analysis["candidates"]),
                "screened_count": len(analysis["screened_candidates"]),
                "quality": {
                    "valid_pixel_fraction": [
                        pair.epoch_a.metadata.get("valid_pixel_fraction"),
                        pair.epoch_b.metadata.get("valid_pixel_fraction"),
                    ],
                    "bad_pixel_fraction": [
                        pair.epoch_a.metadata.get("bad_pixel_fraction"),
                        pair.epoch_b.metadata.get("bad_pixel_fraction"),
                    ],
                    "registration_error": analysis["comparison"].get("registration_error"),
                },
                "elapsed_seconds": round(perf_counter() - started, 3),
            })
        except (ArchiveAdapterError, ObservationValidationError, ValueError) as error:
            results.append({
                "label": field.label,
                "status": "ERROR",
                "query": query,
                "epochs": [],
                "candidate_count": 0,
                "screened_count": 0,
                "quality": {},
                "elapsed_seconds": round(perf_counter() - started, 3),
                "error": str(error),
            })

    ready = sum(result["status"] == "READY TO COMPARE" for result in results)
    caution = sum(result["status"] == "COMPARE WITH CAUTION" for result in results)
    blocked = sum(result["status"] == "COMPARISON NOT RELIABLE" for result in results)
    errors = sum(result["status"] == "ERROR" for result in results)
    return {
        "suite": "SPHEREx live multi-field validation",
        "mode": "real archive data",
        "requested_fields": len(fields),
        "ready_fields": ready,
        "caution_fields": caution,
        "blocked_fields": blocked,
        "error_fields": errors,
        "results": results,
        "limitations": [
            "This is a reproducible archive smoke/quality validation, not a survey completeness or purity estimate.",
            "Results depend on the public archive release, requested coordinates, flags, and network availability.",
            "A promoted residual remains a provisional candidate and requires independent verification.",
        ],
    }
