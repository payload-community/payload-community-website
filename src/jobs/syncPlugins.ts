import type { TaskConfig } from 'payload'

import { syncPlugins } from '@/sync/plugins'

export const syncPluginsTask: TaskConfig<'syncPlugins'> = {
  slug: 'syncPlugins',
  outputSchema: [{ name: 'result', type: 'json' }],
  retries: 2,
  schedule: [{ cron: '0 3 * * *', queue: 'sync' }],
  handler: async ({ req }) => {
    const result = await syncPlugins(req.payload)
    req.payload.logger.info({ job: 'syncPlugins', result }, 'job syncPlugins: finished')

    if (result.status === 'failed')
      throw new Error(`syncPlugins: ${result.error ?? 'GitHub search failed'}`)
    return { output: { result } }
  },
}
