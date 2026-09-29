# Validation

PARALLAX exposes the science service regression suite at `POST /validate/run` and the API-facing report at `GET /api/validation`. The web report is available at `/validation`.

The suite runs against the deterministic `DEMONSTRATION DATASET` and measures behavior after processing. It currently covers:

- known moving-source displacement;
- known brightness change;
- identical-epoch no-change behavior;
- artifact screening without promotion;
- Comparison Guard rejection of incompatible coordinate frames.

The report returns the expected behavior, the measured result, an error where a numeric error is meaningful, and a `PASS`/`FAIL` status. The fixture ground truth is used only after detection for validation; it is not passed into the detector.

These are regression tests, not a survey completeness/purity benchmark or a claim of professional research accuracy. Real archive validation requires calibrated observations, instrument-specific models, quality flags, and an agreed evaluation set.
