import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pge.docutek',
  appName: 'PGE DocuTek',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
};

export default config;
