import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // base relatif supaya build jalan di mana saja:
  // GitHub Pages (subpath /habit_tracker_claude/) maupun Capacitor (file lokal)
  base: './',
  plugins: [react()],
  server: {
    host: true,
  },
});
