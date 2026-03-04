import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        auth: resolve(__dirname, 'auth/index.html'),
        dashboard: resolve(__dirname, 'dashboard/index.html'),
        profile: resolve(__dirname, 'profile/index.html'),
        campaign: resolve(__dirname, 'campaign/index.html')
      }
    }
  }
});
