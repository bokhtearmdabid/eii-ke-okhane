import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // relative paths so the build also works inside an Android WebView later
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: { manualChunks: { phaser: ['phaser'] } },
    },
  },
});