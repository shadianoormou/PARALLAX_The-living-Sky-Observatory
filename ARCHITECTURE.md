# Architecture

PARALLAX is a deliberately separated monorepo. The web experience owns presentation and interaction state. The API owns authenticated product contracts and persistence boundaries. The science service owns numerical and image-processing work. No service invents a data source for another service.

```text
Observation data → FastAPI science engine → candidate extraction
                                      │
                                      ▼
                         ASP.NET API (5080) → PostgreSQL (5432)
                                      │
                                      ▼
                         Next.js web → human classification
```

## Phase 6 boundaries

- `apps/web`: App Router observatory, API-backed explorer, candidate queue/detail views, spectral blink, deterministic explanations, citizen-science review, consensus display, passport, provenance, and methodology modules.
- `apps/api`: typed science client, EF Core entities/migrations, source/run/candidate persistence, classification and confidence endpoints, vote-gated consensus, passport achievement rules, Swagger, and audit logging.
- `services/science`: deterministic synthetic generator, registration, normalization, difference imaging, promoted candidate detection, screened artifact/uncertain review items, analysis, and health/processing endpoints.
- `packages/ui` and `packages/shared-types`: reserved package boundaries with README contracts.

## Persistence flow

`POST /api/demo/run-analysis` calls the typed `IScienceServiceClient`, validates the `DEMONSTRATION DATASET` label, persists source/epoch metadata, stores the raw science response on `ProcessingRun`, and maps returned measurements/spectra to queryable child records. C# never re-runs registration or detection.

Promoted and screened items share the candidate contract but retain explicit classification and status values. The web queue does not create a composite score; it filters stored labels and displays component metrics.

Classification consensus is recalculated only from stored `Classification` rows. `GET /api/candidates/{id}/consensus` returns `403` until the current demo identity has submitted a classification for that candidate. `GET /api/passport` derives review metrics and achievements from classifications and audit entries; `POST /api/passport/modules/{moduleKey}` records learning completion idempotently.

The implemented product flow is:

```text
Observation Data → Science Engine / bounded worker queue → Candidate Extraction → ASP.NET API → PostgreSQL → Web Experience → Human Classification
```

The candidate record links back to its `ProcessingRun`, and that run links to `DatasetSource`, so a public vote never loses its source context.

## Deployment intent

The services are independently deployable. PostgreSQL is the Compose production-shaped provider; SQLite is explicitly a development profile. Production secrets and database credentials must be injected by the deployment environment. The API exposes `/health/live`, database-backed `/health/ready`, `/metrics`, and `/api/ops/metrics`; `PARALLAX_REQUIRE_API_KEY=true` enables API-key/Bearer protection for mutating API calls. The repository includes CI, Playwright Chromium smoke tests, and checksummed PostgreSQL backup/restore scripts. Hosted TLS, WAF, secret-manager, and alert integrations remain deployment-specific configuration.
