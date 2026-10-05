import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(__dirname, 'src/renderer'),
  base: './',
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: [
      { find: '@mini-drive/shared/sync', replacement: path.resolve(__dirname, '../shared/src/sync.js') },
      { find: '@mini-drive/shared/format', replacement: path.resolve(__dirname, '../shared/src/format.js') },
      { find: '@mini-drive/shared/styles.css', replacement: path.resolve(__dirname, '../shared/src/styles.css') },
      { find: /^@mini-drive\/shared$/, replacement: path.resolve(__dirname, '../shared/src/index.js') },
    ],
  },
});
