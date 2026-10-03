import { defineConfig } from "vitest/config";

// tests/ui/*.spec.js belongs to Playwright, which needs a real browser.
// Vitest's default include picks up *.spec.js as well as *.test.js, so
// without this exclusion `npm test` collects those files and fails on the
// missing @playwright/test runner rather than on anything real.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.js"],
    exclude: ["node_modules/**", "tests/ui/**"]
  }
});
