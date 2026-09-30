# Science notes

PARALLAX has two explicit data modes. The deterministic synthetic pipeline is a validation instrument, not a NASA archive observation; the SPHEREx mode loads real IRSA FITS cutouts and remains conservative about quality and interpretation.

## Pipeline

1. Generate two seeded 128 × 128 tangent-plane images with a background, PSF-like stable sources, an injected moving source, a variable source, a narrow artifact, and a low-SNR source.
2. Run the Comparison Guard against dimensions, coordinate frame, overlap, pixel scale, band compatibility, and available registration quality. It returns `READY TO COMPARE`, `COMPARE WITH CAUTION`, or `COMPARISON NOT RELIABLE` with reasons; a blocked pair cannot enter image processing.
3. Validate that both inputs are finite 2D arrays with matching dimensions and required metadata.
4. Build a pixel quality mask from finite values, positive VARIANCE, and non-nominal FLAGS. Unusable archive pixels are replaced only for alignment and cannot become measured residuals.
5. Estimate a translation with phase correlation on clipped, lightly smoothed images. Dynamic tails are clipped so one bright change or artifact cannot dominate the global shift.
6. Apply the sub-pixel translation with cubic interpolation and carry the shifted quality mask into differencing.
7. Estimate a scalar photometric scale from high-signal valid pixels and calculate `Epoch B / scale - Epoch A`.
8. Estimate background noise with MAD / 0.67448975. Candidate extraction uses a Gaussian PSF-like matched-filter proxy, a sigma threshold, connected components, sign pairing, and shape filtering.
9. Pair nearby negative and positive lobes as `apparent_motion`; report their measured displacement. Unpaired positive PSF-like components are reported as `brightness_change` with local-sky-subtracted aperture fluxes.
10. Compare the selected synthetic multi-band samples without assigning a physical class.
11. Screen non-promoted residuals separately: elongated high-SNR components are labeled `likely_artifact`, while measured 3–5σ components are labeled `uncertain` and `needs_review`.
12. Expose the measurements and quality context to human reviewers. A review label and optional confidence are stored as a separate user action; community agreement is not a scientific truth claim.

For an image (I), the robust noise estimate is:

```text
sigma = median(|I - median(I)|) / 0.67448975
```

The detector reports component SNR, lobe separation, registration error, area, shape ratio, overlap fraction, and raw difference statistics. Screened items also carry their screening and promotion thresholds. These are quality metrics, not a single invented probability. A candidate is not a discovery.

## Comparison Guard

`POST /comparison/assess` evaluates two metadata records before image processing. Dimension or coordinate-frame mismatches, insufficient overlap, incompatible bands, and excessive registration uncertainty produce `COMPARISON NOT RELIABLE` and block the pipeline. Partial overlap, incomplete calibration metadata, or elevated but usable registration error produce `COMPARE WITH CAUTION`. A compatible pair with measured registration quality produces `READY TO COMPARE`.

The assessment is persisted beside each API processing run as `ComparisonAssessment` and is exposed through `/api/comparisons/{processingRunId}` and candidate provenance. The UI keeps the status and reason visible so a reviewer can see why a comparison was allowed or blocked.

## Synthetic truth boundary

`generate_synthetic_dataset()` returns `ground_truth` only so tests can compare calculated measurements with injected values. `register_observations`, `difference_observations`, `detect_candidates`, `analyze_observations`, and every FastAPI endpoint receive only `Observation` objects. The processing path cannot inspect the truth structure.

## Limitations

- The registration model is translation-only; rotation, scale, optical distortion, PSF variation, and WCS are not modeled.
- The synthetic PSF is a normalized Gaussian, not an instrument-specific PSF.
- The photometric normalization is scalar and does not model spatial calibration or detector response.
- Thresholds and morphology filters are demo parameters, not survey-calibrated completeness or purity estimates.
- Spectral samples are illustrative arrays with no physical units or archive provenance.
- PGM debug files are visual diagnostics, not calibrated science products.

## SPHEREx / IRSA real-data adapter

`services/science/app/adapters.py` implements `SpherexIrsaAdapter` against IRSA's SIA service. It discovers same-band epochs, requests bounded FITS cutouts, reads IMAGE/FLAGS/VARIANCE extensions, computes a SHA-256 checksum, and attaches the SIA query, source URL, retrieval timestamp, WCS, units, wavelengths, and quality metadata. The science endpoints are `/archive/spherex/search` and `/archive/spherex/analyze`; the API proxies them at `/api/archive/spherex/search` and `/api/archive/spherex/analyze`.

SPHEREx flags are bitmasks. The nominal source-mask bit (`2^21`) is preserved but is not counted as a bad pixel; non-nominal flags are surfaced to Comparison Guard. Display previews are contrast-stretched UI aids and are never used as measurement input.

The archive adapter does not claim a Planet X detection. It reports only measured residuals and conservative candidate language.

All demo material must be marked `DEMONSTRATION DATASET`, linked to provenance, and described as candidate evidence rather than a discovery.
