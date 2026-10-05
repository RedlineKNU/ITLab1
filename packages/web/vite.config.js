import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Order matters: more specific prefixes first.
    alias: [
      { find: '@mini-drive/shared/sync', replacement: path.resolve(__dirname, '../shared/src/sync.js') },
      { find: '@mini-drive/shared/format', replacement: path.resolve(__dirname, '../shared/src/format.js') },
      { find: '@mini-drive/shared/styles.css', replacement: path.resolve(__dirname, '../shared/src/styles.css') },
      { find: /^@mini-drive\/shared$/, replacement: path.resolve(__dirname, '../shared/src/index.js') },
    ],
  },
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
});
