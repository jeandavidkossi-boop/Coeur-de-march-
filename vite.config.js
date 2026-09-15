import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(new URL('.', import.meta.url).pathname, 'index.html'),
        vendre: resolve(new URL('.', import.meta.url).pathname, 'vendre.html'),
        bureau: resolve(new URL('.', import.meta.url).pathname, 'bureau.html'),
      },
    },
  },
});
