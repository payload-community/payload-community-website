import type { TaskConfig } from 'payload'

import { syncPosts } from '@/sync/posts'

export const syncPostsTask: TaskConfig<'syncPosts'> = {
  slug: 'syncPosts',
  inputSchema: [{ name: 'sourceId', type: 'text' }],
  outputSchema: [{ name: 'results', type: 'json' }],
  retries: 2,
  schedule: [{ cron: '0 */6 * * *', queue: 'sync' }],
  handler: async ({ input, req }) => {
    const results = await syncPosts(req.payload, { sourceId: input?.sourceId || undefined })
    req.payload.logger.info({ job: 'syncPosts', results }, 'job syncPosts: finished')

    if (results.length > 0 && results.every((result) => result.status === 'failed')) {
      throw new Error(
        `syncPosts: every source failed (${results.map((r) => `${r.source}: ${r.error}`).join('; ')})`,
      )
    }
    return { output: { results } }
  },
}
