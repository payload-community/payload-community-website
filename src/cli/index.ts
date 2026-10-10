import type { Migration } from 'payload'
import { loadEnv } from 'payload/node'

loadEnv()

const COMMANDS = ['migrate', 'seed', 'seed-dev', 'worker'] as const
type Command = (typeof COMMANDS)[number]

const usage = `Usage: cli <${COMMANDS.join('|')}>`

const main = async (command: Command) => {
  if (command === 'worker') process.env.JOBS_AUTORUN = 'true'

  // Imported after loadEnv so the config sees the environment.
  const [{ getPayload }, { default: config }] = await Promise.all([
    import('payload'),
    import('@payload-config'),
  ])

  if (command === 'worker') {
    const payload = await getPayload({ config, cron: true })
    payload.logger.info('jobs worker started')
    const stop = async (signal: string) => {
      payload.logger.info({ signal }, 'jobs worker stopping')
      await payload.destroy()
      process.exit(0)
    }
    process.once('SIGINT', stop)
    process.once('SIGTERM', stop)
    return
  }

  const payload = await getPayload({ config })
  try {
    if (command === 'migrate') {
      const { migrations } = await import('@/migrations')
      await payload.db.migrate({ migrations: migrations as unknown as Migration[] })
    } else if (command === 'seed') {
      const { seed } = await import('@/seed')
      await seed(payload)
    } else {
      const { seedDev } = await import('@/seed/dev')
      await seedDev(payload)
    }
  } finally {
    await payload.destroy()
  }
  process.exit(0)
}

const command = process.argv[2]
if (!COMMANDS.includes(command as Command)) {
  console.error(usage)
  process.exit(1)
}

main(command as Command).catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
