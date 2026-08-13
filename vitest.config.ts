import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // `include` is load-bearing: without it v8 only instruments files a test
      // already imports, so untested files silently vanish from the
      // denominator and the percentages describe a subset of the codebase.
      include: ['src/**/*.ts'],
      exclude: ['**/*.config.*', '**/dist/**', '**/node_modules/**', 'src/**/*.test.ts'],
      // Ratchet, not an aspiration: these sit at the current honest floor so
      // any regression fails the build. Raise them as coverage improves; the
      // long-term target is 60/60/50/60. The gap is almost entirely Game.ts,
      // the renderers, and main.ts, which need a Pixi stub to reach.
      thresholds: {
        lines: 27,
        functions: 34,
        branches: 34,
        statements: 29,
      },
    },
  },
});
