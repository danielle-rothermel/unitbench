import { defineConfig, devices } from '@playwright/test'

const PORT = 3211
const BASE_URL = `http://localhost:${PORT}`

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
      // dr-code serve facade (serve branch worktree); parser playground
      // e2e drives the page against it with fixture text only.
      command:
        'uv --directory ../dr-code-serve run python -m dr_code.serve serve --port 8321',
      url: 'http://127.0.0.1:8321/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
})
