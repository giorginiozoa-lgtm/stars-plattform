import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build-Konfiguration ausschliesslich fuer die verschickbare Einzeldatei-Demo.
// Einstiegspunkt ist index.demo.html (-> src/main.demo.tsx mit Demo-Backend).
// Das Ergebnis wird anschliessend von scripts/bundle-demo.mjs zu einer
// einzigen HTML-Datei zusammengefuegt.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'demo-dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: 'index.demo.html',
      output: {
        inlineDynamicImports: true,
        entryFileNames: 'assets/demo.js',
        assetFileNames: 'assets/demo.[ext]',
      },
    },
  },
});
