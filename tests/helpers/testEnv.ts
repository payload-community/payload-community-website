import 'dotenv/config'

export const TEST_DATABASE_NAME = 'plc_test'
export const TEST_PORT = 3100
export const TEST_SERVER_URL = `http://localhost:${TEST_PORT}`
export const E2E_GA_MEASUREMENT_ID = 'G-E2ETEST00'

/**
 * Points every test process (Vitest, Playwright runner and its web server) at the
 * test database and the `e2e` S3 key prefix, so tests never touch development data.
 */
export function applyTestEnv(): Record<string, string> {
  if (!process.env.DATABASE_URI) {
    throw new Error('DATABASE_URI is not set; see docs/getting-started.md')
  }

  const databaseURI = new URL(process.env.DATABASE_URI)
  databaseURI.pathname = `/${TEST_DATABASE_NAME}`

  const testEnv = {
    DATABASE_URI: databaseURI.toString(),
    NEXT_DIST_DIR: '.next-e2e',
    // Shows the consent banner; tests intercept requests to Google.
    NEXT_PUBLIC_GA_MEASUREMENT_ID: E2E_GA_MEASUREMENT_ID,
    NEXT_PUBLIC_SERVER_URL: TEST_SERVER_URL,
    S3_KEY_PREFIX: 'e2e',
  }

  Object.assign(process.env, testEnv)

  return testEnv
}
