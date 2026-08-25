import { defineConfig, devices } from "@playwright/test";

// The UI suite renders the module's own templates and stylesheet in a real
// browser. It needs no server — each test calls page.setContent() with a
// document the harness builds — so there is no webServer block here.
export default defineConfig({
  testDir: "./tests/ui",
  testMatch: "**/*.spec.js",
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  use: {
    viewport: { width: 1000, height: 900 },
    screenshot: "only-on-failure"
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } }
  ]
});
