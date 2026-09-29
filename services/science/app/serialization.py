"""JSON-safe response summaries for the FastAPI boundary."""

from __future__ import annotations

from typing import Any

import numpy as np

from .pipeline import DifferenceResult, RegistrationResult
from .synthetic import Observation


def metadata_summary(observation: Observation) -> dict[str, Any]:
    return {**observation.metadata, "spectral_source_ids": sorted(observation.spectra)}


def registration_summary(result: RegistrationResult, epoch_a: Observation, epoch_b: Observation) -> dict[str, Any]:
    return {
        "dataset_label": epoch_a.metadata.get("dataset_label"),
        "epoch_a": metadata_summary(epoch_a),
        "epoch_b": metadata_summary(epoch_b),
        "estimated_shift_yx": list(result.shift_yx),
        "quality": result.quality,
    }


def difference_summary(result: DifferenceResult, epoch_a: Observation, epoch_b: Observation) -> dict[str, Any]:
    return {
        "dataset_label": epoch_a.metadata.get("dataset_label"),
        "epoch_a": metadata_summary(epoch_a),
        "epoch_b": metadata_summary(epoch_b),
        "registration": {"estimated_shift_yx": list(result.registration.shift_yx), "quality": result.registration.quality},
        "photometric_normalization": {"scale_b_to_a": result.normalized_scale},
        "difference": result.stats,
        "difference_preview": preview(result.difference),
    }


def preview(image: np.ndarray, size: int = 32) -> list[list[float]]:
    """Return a small numeric preview rather than hiding pixels behind prose."""

    height, width = image.shape
    y_edges = np.linspace(0, height, size + 1, dtype=int)
    x_edges = np.linspace(0, width, size + 1, dtype=int)
    output = np.zeros((size, size), dtype=np.float32)
    for y in range(size):
        for x in range(size):
            tile = image[y_edges[y]:y_edges[y + 1], x_edges[x]:x_edges[x + 1]]
            output[y, x] = float(np.mean(tile)) if tile.size else 0.0
    return output.round(4).tolist()
