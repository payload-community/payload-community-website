import type { Endpoint } from 'payload'
import { z } from 'zod'

import { isModerator } from '@/access'

import { ACTION_FROM, MODERATED_COLLECTIONS, MODERATION_ACTIONS, type ModerationStatus } from './config'
import { isAuthor, type ModerationContext } from './workflow'

const paramsSchema = z.object({
  action: z.enum(MODERATION_ACTIONS),
  collection: z.enum(MODERATED_COLLECTIONS),
  id: z.string().min(1),
})

const bodySchema = z.object({ reason: z.string().trim().max(2000).optional() }).default({})

const error = (message: string, status: number) => Response.json({ errors: [{ message }] }, { status })

/**
 * `POST /api/moderation/:collection/:id/:action` (spec §8). Runs the Local API write for the
 * action with `context.moderationAction`; the shared hooks set the status and queue the emails.
 * Moderators may run every action; authors may only unpublish their own entries.
 */
export const moderationEndpoint: Endpoint = {
  handler: async (req) => {
    if (!req.user) return error(req.t('error:unauthorized'), 401)
    const moderator = isModerator(req.user)

    const params = paramsSchema.safeParse(req.routeParams)
    if (!params.success) return error(req.t('error:notFound'), 404)
    if (!moderator && params.data.action !== 'unpublish') {
      return error(req.t('error:notAllowedToPerformAction'), 403)
    }
    const body = bodySchema.safeParse(await req.json?.().catch(() => ({})))
    if (!body.success) return error(body.error.issues[0]?.message ?? 'Invalid body', 400)

    const { action, collection, id } = params.data
    const { payload } = req

    const latest = await payload.findByID({
      collection,
      depth: 0,
      disableErrors: true,
      draft: true,
      id,
      overrideAccess: true,
      req,
    })
    if (!latest) return error(req.t('error:notFound'), 404)
    if (!moderator && !isAuthor(latest, req.user)) {
      return error(req.t('error:notAllowedToPerformAction'), 403)
    }

    const status = latest.moderation?.status as ModerationStatus | undefined
    let allowed = Boolean(status && ACTION_FROM[action].includes(status))
    if (!allowed && action === 'unpublish') {
      const main = await payload.findByID({
        collection,
        depth: 0,
        disableErrors: true,
        draft: false,
        id,
        overrideAccess: true,
        req,
        select: { _status: true },
      })
      allowed = main?._status === 'published'
    }
    if (!allowed) return error(`Cannot ${action} an entry with status "${status ?? 'unknown'}".`, 409)

    const context: ModerationContext = { moderationAction: action, moderationReason: body.data.reason }
    const doc = await payload.update({
      collection,
      context,
      data: { _status: action === 'reject' || action === 'unpublish' ? 'draft' : 'published' },
      depth: 0,
      draft: action === 'reject',
      id,
      overrideAccess: true,
      req,
    })

    return Response.json({ doc: { id: doc.id, moderation: doc.moderation }, message: 'OK' })
  },
  method: 'post',
  path: '/moderation/:collection/:id/:action',
}
