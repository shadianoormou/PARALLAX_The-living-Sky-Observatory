# PARALLAX Observatory Android shell

This Capacitor wrapper opens the verified public PARALLAX deployment:

`https://parallax-living-sky-observatory.kitgiz-1946.chatgpt.site`

Build a debug APK from this directory with Java 21 and Android SDK platform 35:

```sh
pnpm install --ignore-workspace
pnpm exec cap sync android
pnpm run apk:debug
```

The APK is an online shell and requires an internet connection to load the observatory.
