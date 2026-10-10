import type { MongooseAdapter } from '@payloadcms/db-mongodb'
import type { Migration, Payload } from 'payload'

import { migrations } from '../../src/migrations'
import { seed, SEED_CONTEXT } from '../../src/seed'
import { DEV_PASSWORD, DEV_USERS } from '../../src/seed/dev'
import { TEST_DATABASE_NAME } from './testEnv'

export const TEST_PASSWORD = DEV_PASSWORD

export const testUsers = {
  admin: { email: DEV_USERS[0].email, password: TEST_PASSWORD },
  moderator: { email: DEV_USERS[1].email, password: TEST_PASSWORD },
  user: { email: DEV_USERS[2].email, password: TEST_PASSWORD },
} as const

/**
 * Empties every collection of the test database (indexes stay), applies migrations, runs the
 * production seed and creates the admin, moderator and regular test users.
 */
export async function resetTestDatabase(payload: Payload): Promise<void> {
  if (new URL(process.env.DATABASE_URI).pathname !== `/${TEST_DATABASE_NAME}`) {
    throw new Error('resetTestDatabase only runs against the plc_test database')
  }

  const db = payload.db as unknown as MongooseAdapter
  const models = [
    ...Object.entries(db.collections)
      .filter(([slug]) => slug !== 'payload-migrations')
      .map(([, model]) => model),
    ...Object.values(db.versions),
    db.globals,
  ]
  await Promise.all(models.map((model) => model.deleteMany({})))

  await payload.db.migrate({ migrations: migrations as unknown as Migration[] })
  await seed(payload)

  for (const user of DEV_USERS) {
    await payload.create({
      collection: 'users',
      context: SEED_CONTEXT,
      data: { ...user, _verified: true, password: TEST_PASSWORD, roles: [...user.roles] },
    })
  }
}
