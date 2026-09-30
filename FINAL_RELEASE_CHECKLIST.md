# PARALLAX final release checklist

This is the Phase 8 release gate. It records what was verified locally and what still depends on the host environment.

## Product and science

- [x] Landing message, observatory, candidate queue, candidate detail, citizen-science review, passport, provenance, architecture, and guided demo routes exist.
- [x] Demo remains explicitly labeled `DEMONSTRATION DATASET`; no live NASA/Planet X claim or fake live connection is present.
- [x] Science tests cover deterministic generation, registration, known displacement, brightness variation, identical-epoch false positives, artifact screening, uncertain review items, higher-noise robustness, bad pairs, spectral measurement shape, and ground-truth exclusion.
- [x] API tests cover candidate retrieval, persisted measurements, demo analysis, provenance epochs/source, classification confidence, vote-gated consensus, passport updates, and Swagger availability.
- [x] The web contract test checks blink/split/difference, divider, spectral blink, classification, consensus, provenance, and the precomputed route.
- [x] Precomputed `data/demo/` assets allow read-only exploration when API/science/SQL Server is unavailable.
- [x] The real SPHEREx path carries FLAGS/VARIANCE quality masks into registration, differencing, and candidate extraction.
- [x] Judge handoff, NASA data credits, and AI-assisted development disclosure are visible in the repository and web methodology route.
- [x] A SQLite local persistence profile enables the full candidate → classification → consensus → passport flow when Docker SQL Server is unavailable; Compose remains SQL Server-backed.
- [x] A repeatable three-field SPHEREx validation report records independent ready/caution/blocked/error outcomes without fabricating archive results.
- [x] PARALLAX X exposes a multi-band SPHEREx evidence graph with per-band quality gates, epochs, candidates, null results, and explicit interpretation limits.
- [x] The judge flow exposes cautious cross-band consistency associations and a measured impact path without inventing adoption numbers.
- [x] Researcher handoff supports shareable query links, JSON evidence export, and persisted opt-in pilot feedback.
- [x] Multi-band evidence processing is bounded-parallel and uses a short-lived cache for repeat review without caching archive errors.
- [x] Best-technology path supports asynchronous job polling, archive retry/backoff, active-job rate limiting, WCS-first association with labeled pixel fallback, timing/cache benchmarks, and JSON/CSV export.
- [x] Privacy-preserving community adoption metrics are persisted and displayed from real classification rows.

## Operations and security

- [x] `docker compose up --build` defines SQL Server, science, API, and web services with health checks and dependency ordering.
- [x] Compose keeps the SQL password in `.env`; `.env.example` contains only a placeholder.
- [x] API startup migration is opt-in through `PARALLAX_APPLY_MIGRATIONS=true` and is enabled by Compose after database readiness.
- [x] Expensive demo analysis is guarded by a single-flight 429 gate.
- [x] Request bounds and confidence validation are enforced; unexpected API errors return safe Problem Details without stack traces.
- [x] CORS is configured from `PARALLAX_CORS_ORIGINS`.
- [ ] A production deployment still needs an ingress/WAF rate limit, secret manager, TLS, backups, and observability configuration.

## Verification commands

```bash
pnpm test
pnpm lint:web
pnpm test:release
pnpm test:explanations
.venv/bin/pytest -q tests/science
dotnet build apps/api/Parallax.Api.csproj --no-restore
dotnet test tests/api/Parallax.Api.Tests.csproj --no-restore
pnpm build:web
```

## Known limitations

- The synthetic fixture remains a deterministic regression instrument; real SPHEREx analysis is bounded exploratory archive inspection, not a survey completeness/purity benchmark.
- Full browser E2E automation is not installed; the web gate is a source contract test plus manual screenshot/rehearsal coverage.
- Docker verification requires Docker Desktop and a host able to pull the .NET, Python, Node, and SQL Server images.
- The local fallback cannot persist votes or consensus, by design.
