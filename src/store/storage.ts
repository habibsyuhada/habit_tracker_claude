import { Preferences } from '@capacitor/preferences';
import type { StateStorage } from 'zustand/middleware';

/**
 * Storage offline-first: di Android/iOS memakai Capacitor Preferences
 * (SharedPreferences / UserDefaults — tahan clear cache WebView),
 * di web otomatis fallback ke localStorage oleh plugin yang sama.
 */
export const offlineStorage: StateStorage = {
  getItem: async (name) => {
    const { value } = await Preferences.get({ key: name });
    return value ?? null;
  },
  setItem: async (name, value) => {
    await Preferences.set({ key: name, value });
  },
  removeItem: async (name) => {
    await Preferences.remove({ key: name });
  },
};
