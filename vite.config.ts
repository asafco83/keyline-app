import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    // ES2019 keeps the embedded runtime (KLEngine.toString()) free of bundler helpers
    target: 'es2019',
    sourcemap: true,
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
  },
});
