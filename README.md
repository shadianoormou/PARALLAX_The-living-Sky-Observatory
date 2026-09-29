# PARALLAX — The Living Sky Observatory

> The sky is not a picture. It is a movie.

PARALLAX is a public-facing scientific exploration platform for comparing repeated sky observations, identifying candidate changes, understanding measurements, and enabling citizen-science review. This repository is currently at **Phase 6: Citizen Science and Provenance**.

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
- Optional: Docker Desktop for the local SQL Server container

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

To start SQL Server locally:

```bash
docker compose up -d sqlserver
```

Apply the EF Core migration after SQL Server is ready:

```bash
dotnet tool restore
pnpm migrate:api
```

The API Swagger UI is at http://localhost:5080/swagger. Open `/explore` and choose **Load demonstration field**; the API calls FastAPI, stores the returned metadata, measurements, spectra, and screened review items, and exposes them through the candidate endpoints. `/candidates` is the Sky Mysteries queue and `/candidates/{id}` is the evidence-first investigation route. `/citizen-science` is the vote-gated review flow, `/passport` reads persisted participation metrics, and `/provenance` exposes the source-to-processing ledger.

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

Phase 6 preserves the API-backed explorer and candidate investigation flow, then adds classification persistence, optional LOW/MEDIUM/HIGH confidence, vote-gated community consensus, a Discovery Passport, restrained achievements, learning-module audit events, and candidate-level provenance. Screened artifact and uncertain cases remain visible with honest statuses instead of being promoted or assigned unsupported probabilities. It does not claim a NASA discovery, connect to a fake live feed, or infer Planet X. Generated assets are development evidence for validating the pipeline and are labeled **DEMONSTRATION DATASET**.

## Product guardrails

- Measurements and interpretations will remain separate in the product model.
- Candidate language is used for anything that requires verification.
- Demonstration records must be labeled **DEMONSTRATION DATASET**.
- The science service is the only place where image registration, difference imaging, and candidate detection are performed.
- Ground truth exists only beside the generator for test evaluation; processing endpoints never receive it.

See [ARCHITECTURE.md](./ARCHITECTURE.md), [SETUP.md](./SETUP.md), [SCIENCE.md](./SCIENCE.md), [DATA_PROVENANCE.md](./DATA_PROVENANCE.md), and [DEMO_SCRIPT.md](./DEMO_SCRIPT.md) for the Phase 6 operating notes.
