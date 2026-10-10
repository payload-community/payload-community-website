import { applyTestEnv } from '../helpers/testEnv'

export default async function globalSetup(): Promise<void> {
  applyTestEnv()
  process.env.JOBS_AUTORUN = 'false'

  const [{ getPayload }, { default: config }, { resetTestDatabase }] = await Promise.all([
    import('payload'),
    import('../../src/payload.config'),
    import('../helpers/testDatabase'),
  ])
  const payload = await getPayload({ config })
  try {
    await resetTestDatabase(payload)
  } finally {
    await payload.destroy()
  }
}
