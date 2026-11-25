import type { Migration } from 'payload'
import { loadEnv } from 'payload/node'

loadEnv()

const COMMANDS = ['migrate', 'seed', 'seed-dev', 'worker', 'self-test'] as const
type Command = (typeof COMMANDS)[number]

const usage = `Usage: cli <${COMMANDS.join('|')}>`

/** Imports the config, tasks, migrations and seed without opening a database connection. */
const selfTest = async () => {
  const [{ default: config }, { jobs }, { migrations }, { seed }] = await Promise.all([
    import('@payload-config'),
    import('@/jobs'),
    import('@/migrations'),
    import('@/seed'),
    import('@/jobs/syncPosts'),
    import('@/jobs/syncPlugins'),
    import('@/jobs/sendEmail'),
    import('@/jobs/sendInvitation'),
  ])
  const loaded = await Promise.resolve(config)
  const slugs = (jobs.tasks ?? []).map((task) => task.slug).sort()
  const required = ['sendEmail', 'sendInvitation', 'syncPlugins', 'syncPosts']
  const missing = required.filter((slug) => !slugs.includes(slug))
  if (!loaded.collections?.length) throw new Error('self-test: payload config did not load')
  if (missing.length > 0) throw new Error(`self-test: missing tasks ${missing.join(', ')}`)
  if (!Array.isArray(migrations) || migrations.length === 0) {
    throw new Error('self-test: migrations did not load')
  }
  if (typeof seed !== 'function') throw new Error('self-test: seed did not load')
  console.log(`self-test ok tasks=${slugs.join(',')}`)
}

const main = async (command: Command) => {
  if (command === 'self-test') {
    await selfTest()
    return
  }

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
