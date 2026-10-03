import { defineConfig, devices } from '@playwright/test';

const CI = !!process.env.CI;

/**
 * End-to-end tests (spec §17). Locally they reuse the API (port 5050) and app (port 4200)
 * if they're already running; in CI both are started here against a fresh MongoDB.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: CI ? 1 : 0,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:4200',
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chrome',
      // Locally use the installed Google Chrome; CI installs Playwright's Chromium
      use: { ...devices['Desktop Chrome'], channel: CI ? undefined : 'chrome', viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: [
    {
      command: 'npm start',
      cwd: '../server',
      url: 'http://localhost:5050/api/v1/health',
      reuseExistingServer: !CI,
      timeout: 60_000,
    },
    {
      // `ng serve` reads PORT (and it beats --port), so pin it to 4200 for the app
      command: 'npx ng serve --port 4200',
      env: { PORT: '4200' },
      cwd: '../client',
      url: 'http://localhost:4200',
      reuseExistingServer: !CI,
      timeout: 180_000,
    },
  ],
});
