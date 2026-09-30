# PARALLAX Observatory desktop app

Secure Electron desktop shell for the deployed PARALLAX Observatory.

```sh
pnpm install --ignore-workspace
pnpm start
pnpm dist:mac
```

The desktop app requires an internet connection because it loads the public observatory deployment. Windows and Linux packages can be produced from the same source with `pnpm dist:win` and `pnpm dist:linux`.
