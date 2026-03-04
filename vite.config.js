import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        auth: resolve(__dirname, 'auth/index.html'),
        dashboard: resolve(__dirname, 'dashboard/index.html'),
        dashboardTotal: resolve(__dirname, 'dashboard/total/index.html'),
        dashboardOngoing: resolve(__dirname, 'dashboard/ongoing/index.html'),
        dashboardPaused: resolve(__dirname, 'dashboard/paused/index.html'),
        dashboardEnded: resolve(__dirname, 'dashboard/ended/index.html'),
        profile: resolve(__dirname, 'profile/index.html'),
        campaign: resolve(__dirname, 'campaign/index.html')
      }
    }
  }
});
