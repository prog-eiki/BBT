import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'gg.bigblacktea.premiertracker',
  appName: 'BigBlackTea Premier',
  webDir: 'apk-dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  backgroundColor: '#0B0C0E',
};

export default config;
