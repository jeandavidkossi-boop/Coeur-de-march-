import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        vendre: resolve(__dirname, 'vendre.html'),
        bureau: resolve(__dirname, 'bureau.html'),
      },
    },
  },
});
