import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [dts()],
  build: {
    target: 'node12',
    emptyOutDir: true,
    lib: {
      entry: 'src/index.ts',
      formats: ['es', 'cjs'],
      name: 'index',
      fileName: 'index',
    },
    rollupOptions: {
      external: ['vite', 'fs/promises', 'path'],
    },
  },
});
