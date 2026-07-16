import { defineConfig, devices } from '@playwright/test'

const PORT = 3211
const BASE_URL = `http://localhost:${PORT}`
const DR_PROVIDERS_SERVE_DIR =
  process.env.DR_PROVIDERS_SERVE_DIR ?? '../dr-providers-serve'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  // Dev-server on-demand compilation makes first page loads slow when
  // several workers hit distinct routes at once.
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: `pnpm dev --port ${PORT}`,
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      // dr-providers serve facade; provider playground e2e uses the
      // ScriptedProvider only — no keys, no network.
      command: `uv --directory ${DR_PROVIDERS_SERVE_DIR} run --extra serve python -m dr_providers.serve serve --port 8322`,
      url: 'http://127.0.0.1:8322/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
})
