from __future__ import annotations

from dataclasses import replace

import numpy as np
import pytest

from services.science.app.pipeline import ObservationValidationError, analyze_observations, assess_comparison_metadata, detect_candidates, difference_observations, register_observations, run_validation_suite, screen_candidates
from services.science.app.synthetic import generate_synthetic_dataset


def test_synthetic_generation_is_deterministic() -> None:
    first = generate_synthetic_dataset(seed=2026)
    second = generate_synthetic_dataset(seed=2026)
    assert np.array_equal(first.epoch_a.image, second.epoch_a.image)
    assert np.array_equal(first.epoch_b.image, second.epoch_b.image)
    assert first.ground_truth == second.ground_truth


def test_registration_recovers_global_shift() -> None:
    dataset = generate_synthetic_dataset()
    result = register_observations(dataset.epoch_a, dataset.epoch_b)
    expected = (-dataset.ground_truth["global_shift_xy"][1], -dataset.ground_truth["global_shift_xy"][0])
    assert np.allclose(result.shift_yx, expected, atol=0.45)
    assert result.quality["overlap_fraction"] > 0.95


def test_known_motion_is_detected_by_measured_displacement() -> None:
    dataset = generate_synthetic_dataset()
    candidates = detect_candidates(dataset.epoch_a, dataset.epoch_b)
    motion = [candidate for candidate in candidates if candidate["classification"] == "apparent_motion"]
    assert motion
    measured = np.array(motion[0]["measurement"]["displacement_pixels_xy"])
    expected = np.array(dataset.ground_truth["moving"]["intrinsic_offset_xy"])
    assert np.allclose(measured, expected, atol=1.5)


def test_known_brightness_change_is_detected() -> None:
    dataset = generate_synthetic_dataset()
    candidates = detect_candidates(dataset.epoch_a, dataset.epoch_b)
    variable = [candidate for candidate in candidates if candidate["classification"] == "brightness_change"]
    assert variable
    assert max(candidate["measurement"]["relative_change"] for candidate in variable) > 0.4


def test_registration_rejects_bad_pairs_before_science_processing() -> None:
    dataset = generate_synthetic_dataset()
    malformed = replace(dataset.epoch_b, image=dataset.epoch_b.image[:-1])
    with pytest.raises(ObservationValidationError, match="COMPARISON NOT RELIABLE"):
        difference_observations(dataset.epoch_a, malformed)


def test_comparison_guard_marks_demo_pair_ready_after_registration() -> None:
    dataset = generate_synthetic_dataset()
    registration = register_observations(dataset.epoch_a, dataset.epoch_b)
    assessment = assess_comparison_metadata(dataset.epoch_a.metadata, dataset.epoch_b.metadata, registration.quality["phase_correlation_error"])
    assert assessment["status"] == "READY TO COMPARE"
    assert assessment["blocking_issues"] == []


def test_comparison_guard_blocks_incompatible_frames() -> None:
    dataset = generate_synthetic_dataset()
    incompatible = {**dataset.epoch_b.metadata, "coordinate_frame": "different-frame"}
    assessment = assess_comparison_metadata(dataset.epoch_a.metadata, incompatible)
    assert assessment["status"] == "COMPARISON NOT RELIABLE"
    assert any("coordinate" in reason.lower() for reason in assessment["blocking_issues"])


def test_spectral_comparison_preserves_measurements_without_physical_labels() -> None:
    dataset = generate_synthetic_dataset()
    analysis = analyze_observations(dataset.epoch_a, dataset.epoch_b)
    moving = next(item for item in analysis["spectral_comparison"] if item["source_id"] == "moving-source")
    assert len(moving["wavelength_um"]) == len(moving["flux_epoch_a"]) == len(moving["flux_epoch_b"])
    assert "classification" not in moving


def test_identical_epochs_do_not_create_candidates() -> None:
    dataset = generate_synthetic_dataset()
    identical_b = replace(dataset.epoch_b, image=dataset.epoch_a.image.copy())
    candidates = detect_candidates(dataset.epoch_a, identical_b)
    assert candidates == []


def test_artifact_is_not_promoted_to_candidate() -> None:
    dataset = generate_synthetic_dataset()
    candidates = detect_candidates(dataset.epoch_a, dataset.epoch_b)
    artifact = np.array(dataset.ground_truth["artifact"]["position_b_xy"])
    for candidate in candidates:
        points = [candidate["measurement"].get("position_xy"), candidate["measurement"].get("position_a_xy"), candidate["measurement"].get("position_b_xy")]
        for point in points:
            if point is not None:
                assert np.linalg.norm(np.array(point) - artifact) > 5.0


def test_screening_preserves_artifact_and_uncertain_cases_without_promoting_them() -> None:
    dataset = generate_synthetic_dataset()
    screened = screen_candidates(dataset.epoch_a, dataset.epoch_b)
    assert {item["classification"] for item in screened} == {"likely_artifact", "uncertain"}
    assert {item["status"] for item in screened} == {"screened", "needs_review"}
    assert all("confidence" not in item["quality"] for item in screened)


def test_injected_signals_survive_higher_noise() -> None:
    dataset = generate_synthetic_dataset(background_sigma=1.8)
    candidates = detect_candidates(dataset.epoch_a, dataset.epoch_b)
    classifications = {candidate["classification"] for candidate in candidates}
    assert "apparent_motion" in classifications
    assert "brightness_change" in classifications


def test_analysis_contains_measurements_without_ground_truth() -> None:
    dataset = generate_synthetic_dataset()
    analysis = analyze_observations(dataset.epoch_a, dataset.epoch_b)
    assert "ground_truth" not in str(analysis)
    assert analysis["dataset_label"] == "DEMONSTRATION DATASET"
    assert analysis["candidates"]


def test_validation_suite_reports_measured_cases() -> None:
    report = run_validation_suite()
    assert report["summary"] == {"passed": 5, "failed": 0, "total": 5}
    assert all(case["status"] == "PASS" for case in report["cases"])
