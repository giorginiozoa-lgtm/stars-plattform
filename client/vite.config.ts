import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Im Dev-Modus werden API-Anfragen an das Backend (Port 4000) weitergeleitet.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
