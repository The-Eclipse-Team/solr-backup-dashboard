import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dev server proxies /api to the Node backend (npm run server), which reads REPORT_DIR.
// In production the same Node backend serves both /api and the built SPA (see server/index.ts),
// so the browser always talks to a single same-origin server — no CORS anywhere.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: { outDir: 'dist' },
});
