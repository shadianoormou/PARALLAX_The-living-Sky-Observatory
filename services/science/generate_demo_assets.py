"""Generate local numeric and visual debug artifacts for the synthetic dataset.

Usage from the repository root:
    .venv/bin/python services/science/generate_demo_assets.py
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from app.pipeline import analyze_observations, detect_candidates, difference_observations, screen_candidates
from app.synthetic import DEMO_LABEL, generate_synthetic_dataset


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "data" / "demo"


def write_pgm(path: Path, image: np.ndarray) -> None:
    low, high = np.percentile(image, [1, 99])
    scaled = np.clip((image - low) / max(high - low, 1e-6), 0, 1)
    pixels = (scaled * 255).astype(np.uint8)
    with path.open("wb") as handle:
        handle.write(f"P5\n{pixels.shape[1]} {pixels.shape[0]}\n255\n".encode("ascii"))
        handle.write(pixels.tobytes())


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    dataset = generate_synthetic_dataset()
    result = difference_observations(dataset.epoch_a, dataset.epoch_b)
    candidates = detect_candidates(dataset.epoch_a, dataset.epoch_b, result)
    screened_candidates = screen_candidates(dataset.epoch_a, dataset.epoch_b, result)
    analysis = analyze_observations(dataset.epoch_a, dataset.epoch_b)
    write_pgm(OUTPUT / "epoch-a.pgm", dataset.epoch_a.image)
    write_pgm(OUTPUT / "epoch-b.pgm", dataset.epoch_b.image)
    write_pgm(OUTPUT / "registered.pgm", result.aligned_b)
    write_pgm(OUTPUT / "difference.pgm", result.difference)
    write_pgm(OUTPUT / "residual.pgm", result.difference / max(result.noise_sigma, 1e-6))
    overlay = result.difference.copy()
    for candidate in [*candidates, *screened_candidates]:
        points = [candidate["measurement"].get("position_xy"), candidate["measurement"].get("position_a_xy"), candidate["measurement"].get("position_b_xy")]
        for point in points:
            if point is None:
                continue
            x, y = [int(round(value)) for value in point]
            overlay[max(0, y - 2):y + 3, max(0, x - 2):x + 3] += np.max(np.abs(overlay)) + 1
    write_pgm(OUTPUT / "candidate-overlay.pgm", overlay)
    summary = {
        "dataset_label": DEMO_LABEL,
        "seed": dataset.epoch_a.metadata["generated_seed"],
        "generated_at_utc": "2026-09-29T00:00:00Z",
        "epochs": analysis["epochs"],
        "candidate_count": len(candidates),
        "candidates": candidates,
        "screened_candidate_count": len(screened_candidates),
        "screened_candidates": screened_candidates,
        "difference": result.stats,
        "spectral_comparison": analysis["spectral_comparison"],
        "provenance_statement": "Synthetic, deterministic, precomputed demonstration artifact; not an astronomical archive observation.",
    }
    (OUTPUT / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(f"Wrote {len(candidates)} candidates and debug outputs to {OUTPUT}")


if __name__ == "__main__":
    main()
