# Release screenshot checklist

Use a running web app at `http://localhost:3000` and capture these routes:

| Route | Required state |
| --- | --- |
| `/` | cinematic intro skipped and full landing hero |
| `/explore` | blink, split, difference, selected candidate, Public and Expert modes |
| `/demo` | guided investigation at step 3, step 7, and step 9 after a vote |
| `/candidates` | Sky Mysteries queue with filters |
| `/citizen-science` | review form before and after submit |
| `/provenance` | source → run → candidate ledger |
| `/architecture` | system chain |

Capture at 1366×768 and at a narrow mobile viewport. Also capture the explicit amber precomputed-fallback banner with Docker/API stopped; the banner is part of the release behavior, not an error to crop away. Check keyboard focus and `prefers-reduced-motion` before the final capture.
