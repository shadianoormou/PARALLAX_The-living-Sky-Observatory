# Data provenance

The `data/demo/` directory contains generated debug artifacts from the deterministic synthetic dataset. These are explicitly not scientific archive observations.

Before any observation is displayed, the product must record:

- source mission or archive;
- dataset and observation identifiers;
- retrieval time;
- coordinate system and units;
- processing version;
- input quality flags;
- whether the record is real or demonstration-only.

The UI must make provenance reachable from the observation and from any candidate review. A missing provenance record is an error state, not an invitation to fill in a plausible value.

The synthetic records carry `dataset_label`, `dataset_id`, seed, shape, coordinate frame, pixel scale, bands, and a provenance status explaining that the data are synthetic. Real SPHEREx records loaded through IRSA carry the collection, observation ID, original FITS URL, reproducible cutout URL, retrieval timestamp, SHA-256 checksum, MJD range, wavelength band, WCS summary, image units, variance summary, and raw/non-nominal flag coverage.

Phase 3 persists this service-generated metadata in `DatasetSource`, `Observation`, `ObservationEpoch`, and `ProcessingRun`. Each processing run also persists a `ComparisonAssessment` with its status, reasons, warnings, and registration quality. Candidate measurements, spectra, algorithm version, request parameters, result JSON, and audit events remain queryable after the processing call completes. Phase 6 also persists screened `likely_artifact` and `uncertain` records with explicit non-promoted statuses, user classifications with optional confidence, vote-derived consensus, and learning-module completion events.

`GET /api/candidates/{id}/provenance` is the candidate-facing trace. It returns the dataset label/type, source identifier, epoch metadata, algorithm version, processing timestamps, and comparison assessment. `GET /api/comparisons/{processingRunId}` returns the same guard record directly. The `/spherex` page exposes the real archive URLs and a manifest for the live query. For the local synthetic source, there is intentionally no external URL; the UI says that the source was generated locally instead of fabricating an archive link.
