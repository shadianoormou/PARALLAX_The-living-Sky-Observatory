# PARALLAX — The Living Sky Observatory

> The sky is not a picture. It is a movie.

PARALLAX is a public-facing scientific exploration platform for comparing repeated sky observations, identifying candidate changes, understanding measurements, and enabling citizen-science review. This repository is at **Phase 8: Release Finalization**.

## Monorepo map

```text
apps/web             Next.js + TypeScript observatory interface
apps/api             ASP.NET Core Web API, EF Core persistence, migrations
services/science     FastAPI science engine and deterministic demo pipeline
packages/ui          Shared design-system primitives (reserved for future extraction)
packages/shared-types Cross-service contracts (reserved for future extraction)
docs                 Product and engineering notes
data/demo            Generated synthetic debug assets, explicitly labeled
scripts               Developer utility boundary
tests/api             ASP.NET integration tests with SQLite provider
tests/science         FastAPI scientific engine tests
```

## Requirements

- Node.js 20.11+ and pnpm 9+
- .NET SDK 10+ (the API targets the runtime available in this workspace)
- Python 3.11+
- Docker Desktop 4.x+ for the one-command stack, or the local runtimes above for service-by-service development

## Exact local run commands

From the repository root:

```bash
cp .env.example .env.local
pnpm install
pnpm dev:web
```

In a second terminal:

```bash
pnpm dev:api
```

In a third terminal:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r services/science/requirements.txt
python3 -m uvicorn app.main:app --app-dir services/science --reload --port 8001
```

The observatory is at http://localhost:3000/explore, the API health endpoint is http://localhost:5080/health, and the science health endpoint is http://localhost:8001/health.

If Docker/SQL Server is unavailable, start the API with the persistent SQLite development profile:

```bash
PARALLAX_DATABASE_PROVIDER=sqlite PARALLAX_APPLY_MIGRATIONS=true dotnet run --project apps/api/Parallax.Api.csproj
```

To start SQL Server locally:

```bash
docker compose up -d sqlserver
```

Apply the EF Core migration after SQL Server is ready:

```bash
dotnet tool restore
pnpm migrate:api
```

## One-command Docker startup

Docker Compose starts SQL Server, applies pending EF migrations once the database is healthy, starts the science service and API, then serves the web app:

```bash
cp .env.example .env
# edit .env and replace MSSQL_SA_PASSWORD with a strong local password
docker compose up --build
```

Open http://localhost:3000. Stop with `Ctrl-C`; remove only the local database volume with `docker compose down -v` when you intentionally want a clean database.

If Docker is unavailable, `/explore` and `/demo` fall back to the checked-in, read-only precomputed artifact in `data/demo/`. That fallback is clearly labeled and cannot pretend to persist classifications or community consensus.

The API Swagger UI is at http://localhost:5080/swagger. Open `/explore` and choose **Load demonstration field**; the API calls FastAPI, stores the returned metadata, measurements, spectra, and screened review items, and exposes them through the candidate endpoints. `/candidates` is the Sky Mysteries queue and `/candidates/{id}` is the evidence-first investigation route. `/citizen-science` is the vote-gated review flow with persisted adoption metrics, `/passport` reads persisted participation metrics, and `/provenance` exposes the source-to-processing ledger.

## Why this challenge matters

Time-domain astronomy is about change: repeated observations can reveal movement, fading, brightening, or a detector artifact that a single image cannot explain. PARALLAX makes that reasoning legible to a public reviewer while keeping measured evidence, provisional interpretation, human classification, and provenance separate.

## Architecture and features

The web app calls an ASP.NET API. The API validates requests, calls the FastAPI science engine, runs and persists the Comparison Guard, persists datasets, observation epochs, processing runs, measurements, spectra, classifications, consensus, and audit events in SQL Server, and exposes a provenance trail. The web experience adds blink, split, difference and residual views, candidate selection, Public/Expert mode, spectral blink, guided demo narration, vote-gated consensus, responsive layouts, and reduced-motion handling.

## Science, provenance, and boundaries

The science service first checks whether two observations are scientifically comparable, then registers the 2D observations, estimates a translation, normalizes photometry, computes a difference image, extracts measured candidate changes, and screens artifacts/low-SNR residuals. The deterministic synthetic source is intentionally labeled and the generator-only ground truth never enters processing responses. See [SCIENCE.md](./SCIENCE.md), [VALIDATION.md](./VALIDATION.md), and [DATA_PROVENANCE.md](./DATA_PROVENANCE.md).

## Verification

```bash
pnpm lint:web
pnpm test
pnpm test:api
pnpm test:science
dotnet build apps/api/Parallax.Api.csproj
python3 -m compileall services/science
.venv/bin/pytest -q tests/science
.venv/bin/python services/science/generate_demo_assets.py
```

Phase 8 hardens the evidence model for release: the science service blocks incompatible comparisons, exposes measured validation cases, covers registration, known changes, false-positive boundaries, artifacts, and noise, and now loads real SPHEREx FITS cutouts through IRSA with reproducible provenance. PARALLAX X adds a judge-ready multi-band evidence graph that keeps each selected band independent while joining epochs, quality gates, screened residuals, candidates, null results, and cautious WCS-aware cross-band associations for human review. Archive work runs through bounded asynchronous jobs with parallel band analysis, short-lived success caching, retry/backoff, active-job rate limiting, and measured timing/cache-hit output; results can be shared by query URL or exported as JSON/CSV handoff bundles. The page records optional persisted pilot feedback without inventing adoption. The API persists provenance, comparison assessments, spectra, classifications, and consensus; the web app supports blink/split/difference, Public/Expert mode, spectral comparison, guided demo review, validation results, live `/spherex` archive inspection, and `/parallax-x` evidence-chain review. The preset demo record is `PX-DEMO-017` and remains labeled **DEMONSTRATION CANDIDATE** / **DEMONSTRATION DATASET**. It does not claim a NASA discovery, infer Planet X, or treat a display preview as measurement data.

## Limitations and future work

This release uses a synthetic 128×128 validation field for regression tests and a bounded SPHEREx/IRSA cutout path for real archive inspection. Real FLAGS/VARIANCE quality masks are applied, but registration remains translation-only and does not yet solve full WCS distortion or instrument-specific PSF fitting. It still uses a single-flight API guard rather than a full production quota system, and manual screenshot/E2E rehearsal rather than a browser automation package. Real-data analysis remains an exploratory candidate workflow, not a survey completeness/purity claim. Future work should add richer WCS-aware registration, instrument-specific PSF fitting, authenticated accounts, production telemetry, managed secrets/backups, and a full browser test matrix.

## Credits

PARALLAX is a course/project observatory prototype built around transparent scientific communication: the detector measures; people review; provenance stays attached to the evidence.

## Screenshot capture

The release capture route list and viewport notes live in [docs/screenshots.md](./docs/screenshots.md). After starting the web app, capture `/`, `/explore`, `/demo`, `/candidates`, `/citizen-science`, `/provenance`, and `/architecture` at desktop and narrow mobile widths. The checks are intentionally manual because this repository does not claim a browser automation dependency.

## Product guardrails

- Measurements and interpretations will remain separate in the product model.
- Candidate language is used for anything that requires verification.
- Demonstration records must be labeled **DEMONSTRATION DATASET**.
- The science service is the only place where image registration, difference imaging, and candidate detection are performed.
- Ground truth exists only beside the generator for test evaluation; processing endpoints never receive it.

See [ARCHITECTURE.md](./ARCHITECTURE.md), [SETUP.md](./SETUP.md), [SCIENCE.md](./SCIENCE.md), [VALIDATION.md](./VALIDATION.md), [DATA_PROVENANCE.md](./DATA_PROVENANCE.md), [DEMO_SCRIPT.md](./DEMO_SCRIPT.md), [JUDGE_HANDOFF.md](./JUDGE_HANDOFF.md), and [FINAL_RELEASE_CHECKLIST.md](./FINAL_RELEASE_CHECKLIST.md) for release operating notes.

## AI and NASA data disclosure

AI-assisted tools were used during software development and copy editing. The NASA/SPHEREx data, numerical measurements, validation fixtures, and candidate interpretations shown by PARALLAX are loaded or calculated by the documented pipeline; they are not generated by an AI model. Real archive credit belongs to NASA/IPAC IRSA and the SPHEREx mission documentation.
