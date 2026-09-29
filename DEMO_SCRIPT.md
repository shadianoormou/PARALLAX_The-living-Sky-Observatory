# Phase 7 / three-minute presentation script

Preparation: start SQL Server, the API, the science service, and the web app using [SETUP.md](./SETUP.md). If the database is clean, the guided route below creates its own labeled demonstration run; no manual seed step is required.

1. **00:00–00:20 / Landing** — Open `/`. Let the short sequence show `1,000,000,000+ objects.`, `Some of them changed.`, `The sky is not a picture.`, and `IT IS A MOVIE.`. Press **Skip intro** once to demonstrate presenter control. The reduced-motion setting skips the animated sequence safely.
2. **00:20–00:40 / Start** — Open `/demo` and press **RUN DEMO INVESTIGATION**. During processing, show the live status labels `ALIGNING STAR FIELD`, `NORMALIZING OBSERVATIONS`, `SEARCHING FOR CHANGES`, `MEASURING CANDIDATE`, and `BUILDING SPECTRAL PROFILE`.
3. **00:40–01:10 / Compare** — Use **COMPARE EPOCHS** and **BLINK**. Pause, resume, go back, and manually select a step. Point out Epoch A/B and the `DEMONSTRATION DATASET` label.
4. **01:10–01:35 / Candidate** — Advance to **REVEAL DETECTED CHANGE** and **OPEN CANDIDATE**. Show the preset `PX-DEMO-017`, labeled `DEMONSTRATION CANDIDATE`, then open its full candidate investigation if time allows.
5. **01:35–02:00 / Measurement** — Show **MEASURE WHAT MOVED**. Read the displacement, SNR, registration error, and the conclusion: `Motion-like candidate — additional observations required.` Do not call it Planet X.
6. **02:00–02:20 / Spectrum and evidence** — Show **BUILD SPECTRAL PROFILE** and **VERIFY THE EVIDENCE**. Emphasize that measurement stays separate from interpretation and that a candidate is not a discovery.
7. **02:20–02:45 / Human review** — In **CLASSIFY THE CANDIDATE**, choose MOVING SOURCE, optionally choose confidence, and submit. Consensus is hidden until the vote, then appears as community opinion with reviewer count—not scientific truth.
8. **02:45–03:00 / Provenance** — Finish at **TRACE PROVENANCE**. Show candidate → processing run → dataset source, epoch IDs, algorithm version, generated date, and the honest synthetic source label. If more time is available, open `/provenance` and `/passport`.

Rehearsal checklist: test with keyboard and visible focus, resize to 1366×768 and a narrow mobile viewport, toggle `prefers-reduced-motion`, and confirm there are no dead buttons or placeholder claims. Run `pnpm test`, `pnpm lint:web`, `pnpm build:web`, `pnpm test:explanations`, `.venv/bin/pytest -q tests/science`, and `dotnet test tests/api/Parallax.Api.Tests.csproj` before presentation.

Phase 7 rehearsal notes: the landing and presenter layout were checked in the local browser at a narrow viewport, including the skippable intro and the API-unavailable boundary. The only unresolved local friction is environmental: Docker/SQL Server is not installed on the rehearsal machine, so the live API-backed ten-step run could not be clicked through there. The real pipeline path is covered by the API integration tests; start SQL Server and the services from [SETUP.md](./SETUP.md) for the full browser rehearsal.
