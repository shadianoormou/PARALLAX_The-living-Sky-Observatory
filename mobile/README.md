# PARALLAX Observatory Android shell

This Capacitor wrapper opens the production PARALLAX deployment with the globally hosted Render API:

`https://parallax-the-living-sky-observatory.vercel.app`

Build a debug APK from this directory with Java 21 and Android SDK platform 35:

```sh
pnpm install --ignore-workspace
pnpm exec cap sync android
pnpm run apk:debug
```

The APK is an online shell and requires an internet connection to load the observatory.
