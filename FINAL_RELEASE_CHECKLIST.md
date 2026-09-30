# PARALLAX final release checklist

This is the Phase 8 release gate. It records what was verified locally and what still depends on the host environment.

## Product and science

- [x] Landing message, observatory, candidate queue, candidate detail, citizen-science review, passport, provenance, architecture, and guided demo routes exist.
- [x] Demo remains explicitly labeled `DEMONSTRATION DATASET`; no live NASA/Planet X claim or fake live connection is present.
- [x] Science tests cover deterministic generation, registration, known displacement, brightness variation, identical-epoch false positives, artifact screening, uncertain review items, higher-noise robustness, bad pairs, spectral measurement shape, and ground-truth exclusion.
- [x] API tests cover candidate retrieval, persisted measurements, demo analysis, provenance epochs/source, classification confidence, vote-gated consensus, passport updates, and Swagger availability.
- [x] The web contract test checks blink/split/difference, divider, spectral blink, classification, consensus, provenance, and the precomputed route.
- [x] Precomputed `data/demo/` assets allow read-only exploration when API/science/PostgreSQL is unavailable.
- [x] The real SPHEREx path carries FLAGS/VARIANCE quality masks into registration, differencing, and candidate extraction.
- [x] Judge handoff, NASA data credits, and AI-assisted development disclosure are visible in the repository and web methodology route.
- [x] A SQLite local persistence profile enables the full candidate → classification → consensus → passport flow when Docker is unavailable; Compose uses a PostgreSQL-backed production-shaped stack.
- [x] A repeatable three-field SPHEREx validation report records independent ready/caution/blocked/error outcomes without fabricating archive results.
- [x] PARALLAX X exposes a multi-band SPHEREx evidence graph with per-band quality gates, epochs, candidates, null results, and explicit interpretation limits.
- [x] The judge flow exposes cautious cross-band consistency associations and a measured impact path without inventing adoption numbers.
- [x] Researcher handoff supports shareable query links, JSON evidence export, and persisted opt-in pilot feedback.
- [x] Global usability surface supports English / বাংলা core navigation, Citizen / Teacher / Researcher modes, keyboard-first skip navigation, large text, high contrast, and screen-reader labels.
- [x] Public evidence bundles are immutable, read-only, SQL-backed, machine-readable, and expiration-bounded.
- [x] Pilot dashboard aggregates optional language, broad region, role, and feedback signals without collecting names, email, or exact location.
- [x] Multi-band evidence processing is bounded-parallel and uses a short-lived cache for repeat review without caching archive errors.
- [x] Best-technology path supports asynchronous job polling, archive retry/backoff, active-job rate limiting, WCS-first association with labeled pixel fallback, timing/cache benchmarks, and JSON/CSV export.
- [x] Privacy-preserving community adoption metrics are persisted and displayed from real classification rows.

## Operations and security

- [x] `docker compose up --build` defines PostgreSQL, science, API, and web services with health checks and dependency ordering.
- [x] Compose keeps the PostgreSQL password in `.env`; `.env.example` contains only placeholders.
- [x] API startup schema bootstrap is opt-in through `PARALLAX_APPLY_MIGRATIONS=true` and is enabled by Compose after database readiness.
- [x] Expensive demo analysis is guarded by a single-flight 429 gate.
- [x] Request bounds and confidence validation are enforced; unexpected API errors return safe Problem Details without stack traces.
- [x] CORS is configured from `PARALLAX_CORS_ORIGINS`.
- [x] API has IP-partitioned global rate limiting, optional API-key/Bearer authentication, structured trace logging, `/health/live`, database-backed `/health/ready`, Prometheus-style `/metrics`, and JSON operational metrics.
- [x] PostgreSQL backup and restore scripts create checksummed custom-format dumps and require explicit restore confirmation.
- [x] CI runs web lint/typecheck/build, API build/tests, science tests, and Playwright Chromium E2E tests.
- [ ] A hosted deployment still needs its platform-specific TLS certificate, WAF/ingress policy, secret-manager binding, and external uptime/alert destination configured.

## Verification commands

```bash
pnpm test
pnpm lint:web
pnpm test:release
pnpm test:explanations
pnpm test:e2e
.venv/bin/pytest -q tests/science
dotnet build apps/api/Parallax.Api.csproj --no-restore
dotnet test tests/api/Parallax.Api.Tests.csproj --no-restore
pnpm build:web
```

## Known limitations

- The synthetic fixture remains a deterministic regression instrument; real SPHEREx analysis is bounded exploratory archive inspection, not a survey completeness/purity benchmark.
- Playwright Chromium E2E now covers the judge route and classroom pilot dashboard; a larger cross-browser/device matrix remains future work.
- Docker verification requires Docker Desktop and a host able to pull the .NET, Python, Node, and PostgreSQL images.
- The local fallback cannot persist votes or consensus, by design.
