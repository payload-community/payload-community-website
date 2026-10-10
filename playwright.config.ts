import { defineConfig, devices } from '@playwright/test'

import { applyTestEnv, TEST_PORT, TEST_SERVER_URL } from './tests/helpers/testEnv'

const testEnv = applyTestEnv()

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  // The first visit of each route compiles it in the dev server.
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Tests share user accounts; concurrent logins of one user race on Payload's `sessions` array.
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: TEST_SERVER_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `pnpm exec next dev --port ${TEST_PORT}`,
    // Tests trigger queued jobs explicitly through /api/payload-jobs/run.
    env: { ...testEnv, JOBS_AUTORUN: 'false' },
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    url: TEST_SERVER_URL,
  },
})
