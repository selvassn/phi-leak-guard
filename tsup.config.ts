import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/vitest.ts', 'src/matchers.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  // `vitest` is a peer/optional dependency used only by the /vitest entry.
  external: ['vitest'],
});
