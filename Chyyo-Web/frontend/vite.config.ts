import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'https://chyyo-cloud-production.up.railway.app',
        changeOrigin: true,
      },
      '/socket.io': {
        target: process.env.VITE_BACKEND_URL || 'https://chyyo-cloud-production.up.railway.app',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
