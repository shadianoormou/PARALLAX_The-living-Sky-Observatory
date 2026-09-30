# Setup

## Web

```bash
pnpm install
pnpm dev:web
```

Open http://localhost:3000/explore. Build and type-check with `pnpm build:web` and `pnpm test`.

## API

```bash
export ConnectionStrings__DefaultConnection='Server=localhost,1433;Database=Parallax;User Id=sa;Password=YOUR_LOCAL_PASSWORD;TrustServerCertificate=True'
dotnet run --project apps/api/Parallax.Api.csproj
curl http://localhost:5080/health
```

The API targets .NET 10 in this foundation build. If you maintain a .NET 8-only deployment, retarget the project after confirming that host's supported runtime.

## Database migrations

```bash
dotnet tool restore
dotnet tool run dotnet-ef migrations list --project apps/api/Parallax.Api.csproj --startup-project apps/api/Parallax.Api.csproj
dotnet tool run dotnet-ef database update --project apps/api/Parallax.Api.csproj --startup-project apps/api/Parallax.Api.csproj
```

The migrations are in `apps/api/Migrations/`, including `AddClassificationConfidence`. The local API uses SQL Server from `ConnectionStrings:DefaultConnection`; tests replace it with an in-memory SQLite connection.

For a persistent local run without Docker/SQL Server, use the SQLite development profile:

```bash
PARALLAX_DATABASE_PROVIDER=sqlite PARALLAX_APPLY_MIGRATIONS=true \
  dotnet run --project apps/api/Parallax.Api.csproj
```

This creates `data/parallax-dev.db` and enables the same candidate, classification, consensus, passport, and community-metrics endpoints locally. Docker Compose continues to use SQL Server for the production-shaped stack.

For a controlled startup migration, set `PARALLAX_APPLY_MIGRATIONS=true`. The API then runs `Database.MigrateAsync()` before listening. It is disabled by default in local development so migration ownership stays explicit; Compose enables it after the SQL Server health check passes.

The safe recovery sequence is: stop the API, verify the database volume is present, run `dotnet tool run dotnet-ef database update ...`, restart the API, and inspect `/health/ready`. Never delete the volume as a first recovery step.

## Science service

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r services/science/requirements.txt
python3 -m uvicorn app.main:app --app-dir services/science --reload --port 8001
curl http://localhost:8001/health
```

The science image adapter also requires `astropy` from `services/science/requirements.txt`. To query real public SPHEREx products through IRSA:

```bash
curl -X POST http://localhost:8001/archive/spherex/analyze \
  -H 'content-type: application/json' \
  -d '{"ra_deg":127.69444,"dec_deg":-39.1776,"radius_deg":0.001,"collection":"spherex_qr2","band":"SPHEREx-D3","cutout_size_deg":0.03,"max_results":20}'
```

The same operation is available through the API at `/api/archive/spherex/analyze`; the browser workflow is `/spherex`. Real archive failures remain explicit and do not silently fall back to synthetic science.

Run the repeatable multi-field real-data check from the repository root:

```bash
.venv/bin/python scripts/validate_spherex_fields.py
```

The same report is available through `POST /archive/spherex/validate` on the science service, `POST /api/archive/spherex/validate` on the API, and the **REAL ARCHIVE VALIDATION** panel at `/validation`. Each field records `READY TO COMPARE`, caution, blocked, or error status independently.

PARALLAX X adds a same-target, multi-band evidence chain. `POST /archive/spherex/evidence-graph` (or `/api/archive/spherex/evidence-graph`) accepts two to six bands and returns per-band epochs, quality gates, candidates, null results, and a provenance graph. The browser workflow is `/parallax-x`. The API proxy allows up to five minutes for a multi-band archive request; configure `ScienceService:TimeoutSeconds` for a different deployment limit. Cross-band agreement is evidence context, not a discovery probability.

For longer archive runs, use `POST /archive/spherex/evidence-graph/jobs` (or the API equivalent) and poll `GET /archive/spherex/evidence-graph/jobs/{job_id}`. Jobs are bounded in-process (`queued` → `processing` → `complete`/`error`) and the UI uses this workflow. Per-band processing is parallel, successful evidence is cached briefly for repeat review, archive 429/5xx responses retry with backoff, and active jobs are rate-limited. Complete archive WCS is used for sky-coordinate associations; incomplete WCS falls back to pixel alignment and is labeled as such. The UI exports both JSON and CSV evidence bundles.

The PARALLAX X result can be shared with its coordinate/band query in the URL and exported as a JSON evidence bundle for researcher handoff. The page also records optional pilot feedback at `/api/research-feedback`; feedback is persisted as an audit event and is not presented as adoption unless a person submits it.

The processing service accepts the deterministic demo request:

```bash
curl -X POST http://localhost:8001/process/analyze \
  -H 'content-type: application/json' \
  -d '{"dataset":"synthetic-demo","seed":2026}'
```

The other processing routes are `/process/register`, `/process/difference`, and `/process/detect`. Responses contain measurements, quality metrics, and candidate language; they do not contain the generator's ground truth.

## Persistence API

After applying the migration and starting both services:

```bash
curl -X POST http://localhost:5080/api/demo/run-analysis \
  -H 'content-type: application/json' \
  -d '{"dataset":"synthetic-demo","seed":2026}'
curl http://localhost:5080/api/candidates
curl http://localhost:5080/swagger
```

Classification submission uses `POST /api/classifications` with `{ "candidate_id": "...", "label": "uncertain", "confidence": "LOW", "notes": "..." }` and an optional `X-Demo-User` header. Valid review labels are `moving_source`, `brightness_change`, `imaging_artifact`, and `uncertain`; confidence is optional and may be `LOW`, `MEDIUM`, or `HIGH`. Consensus remains forbidden until that user has submitted a vote for the candidate. `GET /api/passport` returns derived participation metrics and `POST /api/passport/modules/{moduleKey}` records a learning module.

`GET /api/community/metrics` returns privacy-preserving aggregate adoption evidence: persisted review count, unique reviewer count, candidates reviewed, candidates with consensus, winning agreement, and label counts. The Citizen Science page displays these totals and clearly reports when the database is unavailable.

## SQL Server

```bash
docker compose up -d sqlserver
docker compose ps
```

The explorer, Sky Mysteries queue, citizen-science review, passport, and provenance pages require the API and the persisted demonstration run. If either service is unavailable, they show explicit offline states and do not render placeholder science. Configure a different API origin with `NEXT_PUBLIC_API_BASE_URL` in `.env.local`.

The explorer and guided demo additionally load a checked-in precomputed artifact when the API or science service is unavailable. This is read-only: no live analysis, classification, or consensus is fabricated.

Open `/candidates` for the filtered queue and `/candidates/{id}` for the evidence-first investigation route. The detail route provides deterministic explainability, spectral blink, provenance, and Expert Mode metadata export.

## Explorer controls

- Blink alternates registered Epoch A and Epoch B. Use Slow, Normal, Fast, pause, or manual A/B selection.
- Split provides a draggable divider with synchronized pan and zoom.
- Difference exposes original, registered, difference, and residual views.
- Drag to pan, wheel or +/- to zoom, and use B/S/D plus arrow keys for keyboard control.
- Public mode keeps the evidence panel concise; Expert mode reveals processing and provenance details.
