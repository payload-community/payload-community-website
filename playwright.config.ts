import { defineConfig, devices } from '@playwright/test'

import { applyTestEnv, TEST_PORT, TEST_SERVER_URL } from './tests/helpers/testEnv'

const testEnv = applyTestEnv()

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
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
    env: testEnv,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    url: TEST_SERVER_URL,
  },
})
