import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.habib.habitquest',
  appName: 'HabitQuest',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
};

export default config;
