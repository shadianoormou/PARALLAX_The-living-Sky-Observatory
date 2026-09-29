# Science notes

Phase 6 uses a deterministic synthetic measurement pipeline. The synthetic images are a validation instrument, not a NASA archive observation and not evidence of a discovery.

## Pipeline

1. Generate two seeded 128 × 128 tangent-plane images with a background, PSF-like stable sources, an injected moving source, a variable source, a narrow artifact, and a low-SNR source.
2. Validate that both inputs are finite 2D arrays with matching dimensions and required metadata.
3. Estimate a translation with phase correlation on clipped, lightly smoothed images. Dynamic tails are clipped so one bright change or artifact cannot dominate the global shift.
4. Apply the sub-pixel translation with cubic interpolation.
5. Estimate a scalar photometric scale from high-signal pixels and calculate `Epoch B / scale - Epoch A`.
6. Estimate background noise with MAD / 0.67448975. Candidate extraction uses a Gaussian PSF-like matched-filter proxy, a sigma threshold, connected components, sign pairing, and shape filtering.
7. Pair nearby negative and positive lobes as `apparent_motion`; report their measured displacement. Unpaired positive PSF-like components are reported as `brightness_change` with local-sky-subtracted aperture fluxes.
8. Compare the selected synthetic multi-band samples without assigning a physical class.
9. Screen non-promoted residuals separately: elongated high-SNR components are labeled `likely_artifact`, while measured 3–5σ components are labeled `uncertain` and `needs_review`.
10. Expose the measurements and quality context to human reviewers. A review label and optional confidence are stored as a separate user action; community agreement is not a scientific truth claim.

For an image (I), the robust noise estimate is:

```text
sigma = median(|I - median(I)|) / 0.67448975
```

The detector reports component SNR, lobe separation, registration error, area, shape ratio, overlap fraction, and raw difference statistics. Screened items also carry their screening and promotion thresholds. These are quality metrics, not a single invented probability. A candidate is not a discovery.

## Synthetic truth boundary

`generate_synthetic_dataset()` returns `ground_truth` only so tests can compare calculated measurements with injected values. `register_observations`, `difference_observations`, `detect_candidates`, `analyze_observations`, and every FastAPI endpoint receive only `Observation` objects. The processing path cannot inspect the truth structure.

## Limitations

- The registration model is translation-only; rotation, scale, optical distortion, PSF variation, and WCS are not modeled.
- The synthetic PSF is a normalized Gaussian, not an instrument-specific PSF.
- The photometric normalization is scalar and does not model spatial calibration or detector response.
- Thresholds and morphology filters are demo parameters, not survey-calibrated completeness or purity estimates.
- Spectral samples are illustrative arrays with no physical units or archive provenance.
- PGM debug files are visual diagnostics, not calibrated science products.

## Future real-data adapter

`services/science/app/adapters.py` defines an `ObservationPairAdapter` protocol and a deliberately unimplemented `FutureArchiveAdapter`. Replacing the synthetic adapter requires a verified archive client, source identifiers, retrieval timestamps, coordinate/WCS metadata, units, quality flags, and provenance records. No real endpoint or URL is fabricated in this repository.

All demo material must be marked `DEMONSTRATION DATASET`, linked to provenance, and described as candidate evidence rather than a discovery.
