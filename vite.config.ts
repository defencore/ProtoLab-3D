import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { partModulesPlugin } from './scripts/part-modules/vite-plugin';
import { nativeCadDataPlugin } from './scripts/build/native-cad-data';
import { bundleReportPlugin } from './scripts/build/bundle-report';

export default defineConfig({
  plugins: [
    partModulesPlugin(),
    nativeCadDataPlugin(),
    react(),
    bundleReportPlugin({ startupModules: ['src/App.tsx'] }),
  ],
  base: '/',
  // Catalog and native CAD data use default imports; keep them out of Rollup's property AST.
  json: { stringify: true, namedExports: false },
  worker: { format: 'es', plugins: () => [nativeCadDataPlugin()] },
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
