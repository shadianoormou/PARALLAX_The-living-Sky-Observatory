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
