import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { partModulesPlugin } from './scripts/part-modules/vite-plugin';

export default defineConfig({
  plugins: [partModulesPlugin(), react()],
  base: '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'three-engine': ['three'],
        },
      },
    },
  },
});
