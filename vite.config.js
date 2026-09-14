import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        vendre: resolve(import.meta.dirname, 'vendre.html'),
        bureau: resolve(import.meta.dirname, 'bureau.html'),
      },
    },
  },
});
