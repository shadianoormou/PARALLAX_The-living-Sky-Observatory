import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.parallax.observatory',
  appName: 'PARALLAX Observatory',
  webDir: 'www',
  server: {
    url: 'https://parallax-the-living-sky-observatory.vercel.app',
    cleartext: false,
  },
};

export default config;
