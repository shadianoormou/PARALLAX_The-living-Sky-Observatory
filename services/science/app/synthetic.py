"""Deterministic, explicitly synthetic observations for the demonstration pipeline.

Ground truth is test-only metadata and is never passed to the detector.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np


DEMO_LABEL = "DEMONSTRATION DATASET"
DEFAULT_SEED = 2026
DEFAULT_SHAPE = (128, 128)


@dataclass(frozen=True)
class Observation:
    image: np.ndarray
    metadata: dict[str, Any]
    spectra: dict[str, np.ndarray]


@dataclass(frozen=True)
class SyntheticDataset:
    epoch_a: Observation
    epoch_b: Observation
    ground_truth: dict[str, Any]


def _add_psf(image: np.ndarray, x: float, y: float, flux: float, sigma: float = 1.45) -> None:
    """Add a normalized Gaussian PSF to an image in-place."""

    height, width = image.shape
    radius = max(4, int(np.ceil(4 * sigma)))
    x0 = max(0, int(np.floor(x)) - radius)
    x1 = min(width, int(np.floor(x)) + radius + 1)
    y0 = max(0, int(np.floor(y)) - radius)
    y1 = min(height, int(np.floor(y)) + radius + 1)
    yy, xx = np.mgrid[y0:y1, x0:x1]
    kernel = np.exp(-((xx - x) ** 2 + (yy - y) ** 2) / (2 * sigma**2))
    kernel /= kernel.sum()
    image[y0:y1, x0:x1] += flux * kernel


def _spectrum(kind: str) -> np.ndarray:
    wavelengths = np.array([1.2, 1.8, 2.4, 3.0, 3.6], dtype=np.float32)
    if kind == "moving":
        fluxes = np.array([0.70, 0.92, 1.12, 0.91, 0.62], dtype=np.float32)
    elif kind == "variable":
        fluxes = np.array([0.42, 0.66, 0.98, 1.24, 1.10], dtype=np.float32)
    else:
        fluxes = np.array([0.84, 0.88, 0.86, 0.80, 0.72], dtype=np.float32)
    return np.column_stack((wavelengths, fluxes))


def generate_synthetic_dataset(
    seed: int = DEFAULT_SEED,
    shape: tuple[int, int] = DEFAULT_SHAPE,
    background_sigma: float = 1.0,
) -> SyntheticDataset:
    """Generate repeatable Epoch A/B observations with known injected signals."""

    if len(shape) != 2 or min(shape) < 32:
        raise ValueError("shape must be a 2D image at least 32x32 pixels")
    if background_sigma <= 0:
        raise ValueError("background_sigma must be positive")

    rng = np.random.default_rng(seed)
    background_level = 10.0
    stable_sources = [
        (14.0, 16.0, 22.0), (31.0, 25.0, 30.0), (52.0, 15.0, 18.0),
        (76.0, 19.0, 26.0), (105.0, 17.0, 20.0), (118.0, 33.0, 28.0),
        (18.0, 52.0, 16.0), (52.0, 46.0, 34.0), (72.0, 63.0, 25.0),
        (106.0, 56.0, 19.0), (25.0, 91.0, 31.0), (53.0, 111.0, 21.0),
        (86.0, 101.0, 27.0), (112.0, 91.0, 23.0), (96.0, 119.0, 17.0),
        (15.0, 119.0, 26.0),
    ]
    global_shift_xy = (1.75, -1.25)
    moving_position_a = (40.0, 79.0)
    moving_offset_xy = (4.2, -3.3)
    variable_position_a = (88.0, 39.0)
    artifact_position_b = (102.0, 104.0)
    uncertain_position_a = (64.0, 106.0)

    epoch_a = background_level + rng.normal(0, background_sigma, shape)
    epoch_b = background_level + rng.normal(0, background_sigma, shape)
    spectra_a = {
        "moving-source": _spectrum("moving"),
        "variable-source": _spectrum("variable"),
        "stable-reference": _spectrum("stable"),
    }
    spectra_b = {source_id: spectrum.copy() for source_id, spectrum in spectra_a.items()}
    spectra_b["variable-source"][:, 1] *= 140.0 / 60.0

    for x, y, flux in stable_sources:
        _add_psf(epoch_a, x, y, flux)
        _add_psf(epoch_b, x + global_shift_xy[0], y + global_shift_xy[1], flux)

    _add_psf(epoch_a, *moving_position_a, 110.0)
    _add_psf(epoch_b, moving_position_a[0] + global_shift_xy[0] + moving_offset_xy[0], moving_position_a[1] + global_shift_xy[1] + moving_offset_xy[1], 110.0)

    _add_psf(epoch_a, *variable_position_a, 60.0)
    _add_psf(epoch_b, variable_position_a[0] + global_shift_xy[0], variable_position_a[1] + global_shift_xy[1], 140.0)

    # Narrow cosmic-ray-like artifact: intentionally unlike a PSF.
    artifact_x, artifact_y = artifact_position_b
    epoch_b[int(artifact_y - 5):int(artifact_y + 6), int(artifact_x)] += 34.0
    epoch_b[int(artifact_y), int(artifact_x) + 1] += 22.0

    # Low-SNR variable source, retained to exercise uncertainty behavior.
    _add_psf(epoch_a, *uncertain_position_a, 4.2)
    _add_psf(epoch_b, uncertain_position_a[0] + global_shift_xy[0], uncertain_position_a[1] + global_shift_xy[1], 34.2)

    metadata_common = {
        "dataset_label": DEMO_LABEL,
        "dataset_id": "parallax-synthetic-v1",
        "generated_seed": seed,
        "shape": list(shape),
        "coordinate_frame": "synthetic tangent-plane pixels",
        "pixel_scale_arcsec": 0.4,
        "bands": ["S1", "S2", "S3"],
        "provenance_status": "synthetic, deterministic, not an astronomical archive observation",
    }
    metadata_a = {**metadata_common, "epoch": "A", "observation_id": "synthetic-epoch-a"}
    metadata_b = {**metadata_common, "epoch": "B", "observation_id": "synthetic-epoch-b"}

    truth = {
        "global_shift_xy": list(global_shift_xy),
        "moving": {
            "position_a_xy": list(moving_position_a),
            "position_b_relative_to_a_xy": [moving_offset_xy[0] + global_shift_xy[0], moving_offset_xy[1] + global_shift_xy[1]],
            "intrinsic_offset_xy": list(moving_offset_xy),
        },
        "variable": {"position_a_xy": list(variable_position_a), "flux_a": 60.0, "flux_b": 140.0},
        "artifact": {"position_b_xy": list(artifact_position_b), "kind": "cosmic-ray-like narrow feature"},
        "uncertain": {"position_a_xy": list(uncertain_position_a), "flux_epoch_a": 4.2, "flux_epoch_b": 34.2},
        "stable_count": len(stable_sources),
    }

    return SyntheticDataset(
        epoch_a=Observation(epoch_a.astype(np.float32), metadata_a, spectra_a),
        epoch_b=Observation(epoch_b.astype(np.float32), metadata_b, spectra_b),
        ground_truth=truth,
    )
