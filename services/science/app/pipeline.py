"""Numerical processing for repeated observations.

The detector operates only on observations and metadata. It has no access to
the synthetic generator's ground-truth structure.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
from scipy import ndimage
from skimage.registration import phase_cross_correlation

from .synthetic import Observation


class ObservationValidationError(ValueError):
    """Raised when an observation pair cannot be compared safely."""


@dataclass(frozen=True)
class RegistrationResult:
    aligned_b: np.ndarray
    shift_yx: tuple[float, float]
    quality: dict[str, float]


@dataclass(frozen=True)
class DifferenceResult:
    aligned_b: np.ndarray
    normalized_scale: float
    difference: np.ndarray
    noise_sigma: float
    stats: dict[str, float]
    registration: RegistrationResult


def validate_observations(epoch_a: Observation, epoch_b: Observation) -> None:
    if epoch_a.image.ndim != 2 or epoch_b.image.ndim != 2:
        raise ObservationValidationError("both observations must be 2D images")
    if epoch_a.image.shape != epoch_b.image.shape:
        raise ObservationValidationError("observation dimensions must match")
    if not np.isfinite(epoch_a.image).all() or not np.isfinite(epoch_b.image).all():
        raise ObservationValidationError("observations must contain only finite values")
    required = {"observation_id", "epoch", "coordinate_frame", "shape"}
    for observation in (epoch_a, epoch_b):
        missing = sorted(required.difference(observation.metadata))
        if missing:
            raise ObservationValidationError(f"missing metadata: {', '.join(missing)}")


def robust_sigma(image: np.ndarray) -> float:
    median = float(np.median(image))
    mad = float(np.median(np.abs(image - median)))
    sigma = mad / 0.6744897501960817
    return max(sigma, float(np.std(image)) * 0.1, 1e-6)


def register_observations(epoch_a: Observation, epoch_b: Observation) -> RegistrationResult:
    """Estimate and apply a translation using phase correlation."""

    validate_observations(epoch_a, epoch_b)
    # Clipping the high dynamic-range tails keeps the injected moving source and
    # narrow artifact from dominating the global translation estimate.
    reference_median = float(np.median(epoch_a.image))
    moving_median = float(np.median(epoch_b.image))
    reference_for_registration = ndimage.gaussian_filter(np.clip(epoch_a.image, reference_median, reference_median + 5.0), sigma=1.0)
    moving_for_registration = ndimage.gaussian_filter(np.clip(epoch_b.image, moving_median, moving_median + 5.0), sigma=1.0)
    shift, error, _ = phase_cross_correlation(
        reference_for_registration,
        moving_for_registration,
        upsample_factor=20,
        normalization=None,
    )
    shift_yx = (float(shift[0]), float(shift[1]))
    aligned_b = ndimage.shift(epoch_b.image, shift=shift_yx, order=3, mode="constant", cval=float(np.median(epoch_b.image)), prefilter=True)
    overlap = (1 - abs(shift_yx[0]) / epoch_a.image.shape[0]) * (1 - abs(shift_yx[1]) / epoch_a.image.shape[1])
    return RegistrationResult(
        aligned_b=aligned_b.astype(np.float32),
        shift_yx=shift_yx,
        quality={"phase_correlation_error": float(error), "overlap_fraction": float(max(0.0, overlap))},
    )


def photometric_normalize(reference: np.ndarray, aligned_b: np.ndarray) -> float:
    """Estimate a scalar brightness ratio from high-signal finite pixels."""

    ref_sigma = robust_sigma(reference)
    ref_floor = float(np.median(reference)) + 3.0 * ref_sigma
    candidate_mask = (reference > ref_floor) & (aligned_b > ref_floor)
    ratios = aligned_b[candidate_mask] / np.maximum(reference[candidate_mask], 1e-6)
    ratios = ratios[np.isfinite(ratios)]
    if ratios.size < 8:
        return 1.0
    return float(np.clip(np.median(ratios), 0.5, 2.0))


def difference_observations(epoch_a: Observation, epoch_b: Observation) -> DifferenceResult:
    registration = register_observations(epoch_a, epoch_b)
    scale = photometric_normalize(epoch_a.image, registration.aligned_b)
    difference = registration.aligned_b / scale - epoch_a.image
    noise_sigma = robust_sigma(difference)
    stats = {
        "minimum": float(np.min(difference)),
        "maximum": float(np.max(difference)),
        "median": float(np.median(difference)),
        "mean": float(np.mean(difference)),
        "rms": float(np.sqrt(np.mean(np.square(difference)))),
        "noise_sigma": noise_sigma,
    }
    return DifferenceResult(registration.aligned_b, scale, difference.astype(np.float32), noise_sigma, stats, registration)


def _component(image: np.ndarray, labels: np.ndarray, index: int, difference: np.ndarray, noise_sigma: float) -> dict[str, Any]:
    coords = np.argwhere(labels == index)
    y0, x0 = coords.min(axis=0)
    y1, x1 = coords.max(axis=0)
    values = difference[labels == index]
    weights = np.abs(values)
    centroid_y = float(np.average(coords[:, 0], weights=weights))
    centroid_x = float(np.average(coords[:, 1], weights=weights))
    peak_index = int(np.argmax(np.abs(values)))
    peak_y, peak_x = coords[peak_index]
    height = int(y1 - y0 + 1)
    width = int(x1 - x0 + 1)
    shape_ratio = max(height, width) / max(1, min(height, width))
    sign = 1 if float(np.sum(values)) >= 0 else -1
    return {
        "centroid_xy": [centroid_x, centroid_y],
        "peak_xy": [int(peak_x), int(peak_y)],
        "area_pixels": int(coords.shape[0]),
        "sum_signal": float(np.sum(values)),
        "peak_signal": float(difference[peak_y, peak_x]),
        "snr": float(np.max(np.abs(values)) / max(noise_sigma, 1e-6)),
        "sign": sign,
        "bbox": [int(x0), int(y0), width, height],
        "shape_ratio": float(shape_ratio),
    }


def _aperture_sum(image: np.ndarray, x: float, y: float, radius: float = 3.0) -> float:
    yy, xx = np.ogrid[: image.shape[0], : image.shape[1]]
    distance_squared = (xx - x) ** 2 + (yy - y) ** 2
    aperture = distance_squared <= radius**2
    annulus = (distance_squared > (radius + 2.0) ** 2) & (distance_squared <= (radius + 4.0) ** 2)
    sky = float(np.median(image[annulus])) if np.any(annulus) else float(np.median(image))
    return float(np.sum(image[aperture] - sky))


def detect_candidates(
    epoch_a: Observation,
    epoch_b: Observation,
    difference: DifferenceResult | None = None,
    threshold_sigma: float = 5.0,
) -> list[dict[str, Any]]:
    """Extract candidate changes from a registered difference image."""

    result = difference or difference_observations(epoch_a, epoch_b)
    # Matched-filter-like smoothing improves sensitivity to PSF-shaped changes
    # while preserving a separate raw-difference noise metric for reporting.
    detection_image = ndimage.gaussian_filter(result.difference, sigma=1.0)
    detection_noise_sigma = robust_sigma(detection_image)
    threshold = threshold_sigma * detection_noise_sigma
    mask = np.abs(detection_image) >= threshold
    labels, count = ndimage.label(mask, structure=np.ones((3, 3), dtype=np.uint8))
    components = [
        _component(detection_image, labels, index, detection_image, detection_noise_sigma)
        for index in range(1, count + 1)
    ]
    # Cosmic-ray-like elongated components remain diagnostic but are not promoted.
    components = [component for component in components if component["area_pixels"] >= 3 and component["shape_ratio"] <= 3.0]
    used: set[int] = set()
    candidates: list[dict[str, Any]] = []

    for index, component in enumerate(components):
        if index in used:
            continue
        x, y = component["centroid_xy"]
        partner_index = None
        partner_distance = float("inf")
        if component["sign"] < 0:
            for other_index, other in enumerate(components):
                if other_index == index or other_index in used or other["sign"] >= 0:
                    continue
                ox, oy = other["centroid_xy"]
                distance = float(np.hypot(ox - x, oy - y))
                if distance <= 12.0 and distance < partner_distance:
                    partner_index = other_index
                    partner_distance = distance
        else:
            for other_index, other in enumerate(components):
                if other_index == index or other_index in used or other["sign"] >= 0:
                    continue
                ox, oy = other["centroid_xy"]
                distance = float(np.hypot(ox - x, oy - y))
                if distance <= 12.0 and distance < partner_distance:
                    partner_index = other_index
                    partner_distance = distance
        if partner_index is not None:
            positive = components[partner_index]
            used.update({index, partner_index})
            if component["sign"] > 0:
                negative = positive
                positive = component
            else:
                negative = component
            nx, ny = negative["centroid_xy"]
            px, py = positive["centroid_xy"]
            displacement = [float(px - nx), float(py - ny)]
            candidates.append({
                "candidate_id": f"motion-{len(candidates) + 1:03d}",
                "classification": "apparent_motion",
                "measurement": {
                    "position_a_xy": [float(nx), float(ny)],
                    "position_b_xy": [float(px), float(py)],
                    "displacement_pixels_xy": displacement,
                    "displacement_arcsec_xy": [value * 0.4 for value in displacement],
                },
                "quality": {
                    "negative_lobe_snr": negative["snr"],
                    "positive_lobe_snr": positive["snr"],
                    "pair_separation_pixels": partner_distance,
                    "registration_error": result.registration.quality["phase_correlation_error"],
                },
                "interpretation": "possible apparent motion; requires additional verification",
            })
            continue

        if component["sign"] > 0:
            used.add(index)
            flux_a = _aperture_sum(epoch_a.image, x, y)
            flux_b = _aperture_sum(result.aligned_b, x, y) / result.normalized_scale
            delta_flux = flux_b - flux_a
            candidates.append({
                "candidate_id": f"change-{len(candidates) + 1:03d}",
                "classification": "brightness_change",
                "measurement": {
                    "position_xy": [float(x), float(y)],
                    "aperture_flux_epoch_a": flux_a,
                    "aperture_flux_epoch_b": flux_b,
                    "delta_flux": delta_flux,
                    "relative_change": delta_flux / max(abs(flux_a), 1e-6),
                },
                "quality": {
                    "component_snr": component["snr"],
                    "area_pixels": component["area_pixels"],
                    "shape_ratio": component["shape_ratio"],
                    "registration_error": result.registration.quality["phase_correlation_error"],
                },
                "interpretation": "possible brightness change; requires additional verification",
            })

    return candidates


def screen_candidates(
    epoch_a: Observation,
    epoch_b: Observation,
    difference: DifferenceResult | None = None,
    screening_threshold_sigma: float = 3.0,
) -> list[dict[str, Any]]:
    """Return measured but non-promoted review items.

    Screening output is deliberately separate from promoted candidates. It gives
    the review queue an honest way to show elongated residuals and low-SNR
    changes without treating either as a discovery or a classification.
    """

    result = difference or difference_observations(epoch_a, epoch_b)
    detection_image = ndimage.gaussian_filter(result.difference, sigma=1.0)
    detection_noise_sigma = robust_sigma(detection_image)

    def components_at(threshold_sigma: float) -> list[dict[str, Any]]:
        mask = np.abs(detection_image) >= threshold_sigma * detection_noise_sigma
        labels, count = ndimage.label(mask, structure=np.ones((3, 3), dtype=np.uint8))
        return [
            _component(detection_image, labels, index, detection_image, detection_noise_sigma)
            for index in range(1, count + 1)
        ]

    review_items: list[dict[str, Any]] = []
    artifact = [component for component in components_at(5.0) if component["area_pixels"] >= 3 and component["shape_ratio"] > 3.0]
    if artifact:
        component = max(artifact, key=lambda item: item["snr"])
        review_items.append({
            "candidate_id": "artifact-001",
            "classification": "likely_artifact",
            "status": "screened",
            "measurement": {
                "position_xy": component["centroid_xy"],
                "area_pixels": component["area_pixels"],
                "shape_ratio": component["shape_ratio"],
                "peak_signal": component["peak_signal"],
            },
            "quality": {
                "component_snr": component["snr"],
                "screening_threshold_sigma": 5.0,
                "registration_error": result.registration.quality["phase_correlation_error"],
            },
            "interpretation": "elongated residual; likely artifact; not promoted for citizen-science classification",
        })

    uncertain = [
        component for component in components_at(screening_threshold_sigma)
        if 3.0 <= component["snr"] < 5.0 and component["area_pixels"] >= 3 and component["shape_ratio"] <= 3.0
    ]
    if uncertain:
        component = max(uncertain, key=lambda item: item["snr"])
        review_items.append({
            "candidate_id": "uncertain-001",
            "classification": "uncertain",
            "status": "needs_review",
            "measurement": {
                "position_xy": component["centroid_xy"],
                "area_pixels": component["area_pixels"],
                "peak_signal": component["peak_signal"],
            },
            "quality": {
                "component_snr": component["snr"],
                "screening_threshold_sigma": screening_threshold_sigma,
                "promotion_threshold_sigma": 5.0,
                "registration_error": result.registration.quality["phase_correlation_error"],
            },
            "interpretation": "low-SNR residual; insufficient evidence for promotion; requires additional verification",
        })

    return review_items


def analyze_observations(epoch_a: Observation, epoch_b: Observation) -> dict[str, Any]:
    result = difference_observations(epoch_a, epoch_b)
    candidates = detect_candidates(epoch_a, epoch_b, result)
    screened_candidates = screen_candidates(epoch_a, epoch_b, result)
    return {
        "dataset_label": epoch_a.metadata.get("dataset_label", "UNLABELLED"),
        "epochs": {"a": epoch_a.metadata, "b": epoch_b.metadata},
        "registration": {"shift_yx": list(result.registration.shift_yx), "quality": result.registration.quality},
        "photometric_normalization": {"scale_b_to_a": result.normalized_scale},
        "difference": result.stats,
        "spectral_comparison": compare_spectra(epoch_a, epoch_b),
        "candidates": candidates,
        "screened_candidates": screened_candidates,
        "interpretation_policy": "Measurements are calculated; candidate interpretations are provisional and require additional verification.",
    }


def compare_spectra(epoch_a: Observation, epoch_b: Observation) -> list[dict[str, Any]]:
    """Compare selected multi-band samples without assigning a physical class."""

    shared_sources = sorted(set(epoch_a.spectra).intersection(epoch_b.spectra))
    comparisons: list[dict[str, Any]] = []
    for source_id in shared_sources:
        spectrum_a = epoch_a.spectra[source_id]
        spectrum_b = epoch_b.spectra[source_id]
        if spectrum_a.shape != spectrum_b.shape or spectrum_a.ndim != 2 or spectrum_a.shape[1] != 2:
            continue
        delta = spectrum_b[:, 1] - spectrum_a[:, 1]
        comparisons.append({
            "source_id": source_id,
            "wavelength_um": spectrum_a[:, 0].astype(float).tolist(),
            "flux_epoch_a": spectrum_a[:, 1].astype(float).round(6).tolist(),
            "flux_epoch_b": spectrum_b[:, 1].astype(float).round(6).tolist(),
            "delta_flux": delta.astype(float).round(6).tolist(),
            "interpretation": "spectral sample comparison only; no physical classification is assigned",
        })
    return comparisons
