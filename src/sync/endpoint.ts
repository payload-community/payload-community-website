import type { Endpoint, PayloadRequest } from 'payload'
import { z } from 'zod'

import { isAdmin } from '@/access'
import { isCronRequest } from '@/jobs/access'

export const SYNC_TASKS = { plugins: 'syncPlugins', posts: 'syncPosts' } as const

const paramsSchema = z.object({ task: z.enum(['plugins', 'posts']) })
const bodySchema = z.object({ sourceId: z.string().min(1).optional() }).default({})

const error = (message: string, status: number) =>
  Response.json({ errors: [{ message }] }, { status })

/** An unfinished job of the task (queued, running or waiting for a retry), so triggers do not pile up. */
const findOpenJob = async (req: PayloadRequest, taskSlug: string) => {
  const { docs } = await req.payload.find({
    collection: 'payload-jobs',
    depth: 0,
    limit: 1,
    pagination: false,
    req,
    where: {
      and: [
        { taskSlug: { equals: taskSlug } },
        { completedAt: { exists: false } },
        { hasError: { not_equals: true } },
      ],
    },
  })
  return docs[0]
}

/**
 * `POST /api/sync/:task` (`posts` | `plugins`, spec §9): admins or `Authorization: Bearer
 * CRON_SECRET`. Only queues the task on the `sync` queue; the worker (or autoRun) runs it.
 */
export const syncEndpoint: Endpoint = {
  handler: async (req) => {
    if (!isAdmin(req.user) && !isCronRequest(req.headers)) {
      return error(
        req.t(req.user ? 'error:notAllowedToPerformAction' : 'error:unauthorized'),
        req.user ? 403 : 401,
      )
    }

    const params = paramsSchema.safeParse(req.routeParams)
    if (!params.success) return error(req.t('error:notFound'), 404)
    const body = bodySchema.safeParse(await req.json?.().catch(() => ({})))
    if (!body.success) return error(body.error.issues[0]?.message ?? 'Invalid body', 400)

    const task = SYNC_TASKS[params.data.task]
    const open = await findOpenJob(req, task)
    if (open) return Response.json({ alreadyQueued: true, jobId: open.id }, { status: 202 })

    const job =
      task === 'syncPosts'
        ? await req.payload.jobs.queue({
            input: { sourceId: body.data.sourceId },
            queue: 'sync',
            req,
            task,
          })
        : await req.payload.jobs.queue({ input: {}, queue: 'sync', req, task })
    req.payload.logger.info({ jobId: job.id, task }, 'sync: job queued manually')
    return Response.json({ alreadyQueued: false, jobId: job.id }, { status: 202 })
  },
  method: 'post',
  path: '/sync/:task',
}
