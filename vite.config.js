import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteCompression from 'vite-plugin-compression';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), viteCompression(
    {
      verbose: true,
      disable: false,
      threshold: 10240,
      algorithm: 'gzip',
      ext: '.gz',
    }
  )],
  base: '/rop-ide/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});