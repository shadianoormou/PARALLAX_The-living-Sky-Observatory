# Phase 6 demo script

1. Start SQL Server, the API, the science service, and the web app using [SETUP.md](./SETUP.md).
2. Open `/explore` from the landing CTA and confirm the observatory shows its premium loading sequence.
3. If the database is empty, choose **Load demonstration field**. Confirm the field is labeled `DEMONSTRATION DATASET`.
4. In Blink, pause and manually toggle Epoch A/B. Watch the stored `motion-002` candidate move between its measured positions.
5. In Split, drag the divider and pan/zoom the synchronized field. Select `change-001` and verify its stored brightness measurement appears in the evidence panel.
6. In Difference, inspect Original, Registered, Difference, and Residual. Read the concise registered-B-minus-A explanation.
7. Toggle Public / Expert mode. Confirm Expert mode reveals the algorithm version, coordinate frame, pixel scale, and provenance statement.
8. Use the keyboard: arrows pan, +/- zoom, B/S/D switch modes, A/B select epochs, and space pauses Blink.
9. Open **Sky Mysteries**, filter by `high apparent motion`, `brightness change`, `uncertain`, and `likely artifact`; confirm the queue uses labels and component metrics rather than a composite score.
10. Open each candidate detail. Confirm Position, Brightness, Spectrum, the deterministic explanation, evidence breakdown, provenance, and Expert Mode metadata JSON export.
11. In Spectral Blink, inspect Overlay, Difference, Normalized, hover band readouts, and animated transition. Confirm uncertainty is called out as unavailable when it is not stored.
12. Run `pnpm test`, `pnpm lint:web`, `pnpm build:web`, `pnpm test:explanations`, `.venv/bin/pytest -q tests/science`, and `dotnet test tests/api/Parallax.Api.Tests.csproj`.
13. Open `/citizen-science`. Confirm the candidate source badge says `DEMONSTRATION DATASET`, choose one of MOVING SOURCE, BRIGHTNESS CHANGE, IMAGING ARTIFACT, or UNCERTAIN, optionally choose confidence, and submit. Confirm consensus was hidden before submission and appears afterward as community percentages with a reviewer count.
14. Open `/passport`. Confirm Objects inspected, Candidates reviewed, Consensus matches, and FIRST LIGHT update from the review. Open `/science`, complete a module, and confirm Learning modules completed updates on the passport.
15. Open `/provenance` and verify candidate → processing run → dataset source, both epoch IDs, observation metadata, bands/coordinate frame, timestamps, and the synthetic source label. Open `/architecture` and confirm the displayed flow matches the actual service boundaries.

The guided citizen-science review is intentionally scoped to persisted candidate records and explicit community opinion. It does not imply a live astronomy feed or a discovery.
