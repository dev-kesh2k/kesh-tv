import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Desenvolvimento: o frontend (5173) repassa /api para o backend local (porta 3000, ou BACKEND_URL).
    proxy: {
      '/api': { target: process.env.BACKEND_URL || 'http://localhost:3000', changeOrigin: true },
    },
  },
});
