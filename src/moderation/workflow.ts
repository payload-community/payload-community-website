import type {
  CollectionAfterChangeHook,
  CollectionBeforeChangeHook,
  CollectionBeforeOperationHook,
  RequestContext,
} from 'payload'
import { Forbidden } from 'payload'

import { isModerator, isSystem } from '@/access'

import { isModeratedCollection, type ModerationAction, type ModerationStatus } from './config'
import { assertSubmissionSlot } from './limit'
import { queueModerationEmails, type ModerationEvent } from './notifications'

type ModerationGroup = {
  moderatedAt?: string | null
  moderatedBy?: number | string | { id: number | string } | null
  rejectionReason?: string | null
  status?: ModerationStatus | null
  submittedAt?: string | null
}

/** Request context set by the moderation endpoint (and by the built-in Unpublish control). */
export type ModerationContext = RequestContext & {
  moderationAction?: ModerationAction
  moderationReason?: string | null
}

const idOf = (value: unknown): number | string | null => {
  if (value && typeof value === 'object' && 'id' in value) return (value as { id: number | string }).id
  return typeof value === 'string' || typeof value === 'number' ? value : null
}

/**
 * Regular users can only write drafts (spec §6.2): publishing through admin, REST or GraphQL is
 * impossible for them. A moderator's main-document write with `_status: 'draft'` is Payload's
 * Unpublish control; it is treated as the `unpublish` moderation action.
 */
export const enforceDrafts: CollectionBeforeOperationHook = ({ args, operation, req }) => {
  if (operation !== 'create' && operation !== 'update') return args
  if (isSystem(req) || !req.user) return args

  if (!isModerator(req.user)) return { ...args, data: { ...args.data, _status: 'draft' }, draft: true }

  const context = req.context as ModerationContext
  const status = (args.data as { _status?: string } | undefined)?._status
  if (operation === 'update' && !args.draft && status === 'draft' && !context.moderationAction) {
    context.moderationAction = 'unpublish'
  }
  return args
}

/**
 * Computes the next `moderation` group (spec §6.3) and applies the submission limit (§7). Values
 * sent by users are ignored: only moderation actions, moderator publishing and system writes
 * change the status.
 */
export const applyModerationState: CollectionBeforeChangeHook = async ({
  context,
  data,
  operation,
  originalDoc,
  req,
}) => {
  const previous: ModerationGroup =
    operation === 'update' ? ((originalDoc?.moderation as ModerationGroup | undefined) ?? {}) : {}
  const incoming = (data.moderation as ModerationGroup | undefined) ?? {}
  const { moderationAction: action, moderationReason } = context as ModerationContext
  const now = new Date().toISOString()
  const user = req.user
  const withModeration = (moderation: ModerationGroup) => ({ ...data, moderation })

  if (action) {
    if (!isModerator(user)) throw new Forbidden(req.t)
    const decided = { ...previous, moderatedAt: now, moderatedBy: user!.id }
    if (action === 'reject') {
      return withModeration({ ...decided, rejectionReason: moderationReason || null, status: 'rejected' })
    }
    if (action === 'unpublish') return withModeration({ ...decided, status: 'unpublished' })
    return withModeration({ ...decided, rejectionReason: null, status: 'published' })
  }

  if (isSystem(req) || !user) {
    if (operation === 'update') return withModeration({ ...previous, ...incoming })
    return withModeration({
      ...incoming,
      status: data._status === 'published' ? 'published' : (incoming.status ?? 'pending'),
      submittedAt: incoming.submittedAt ?? now,
    })
  }

  if (isModerator(user)) {
    if (data._status === 'published') {
      if (previous.status === 'published') return withModeration(previous)
      return withModeration({
        ...previous,
        moderatedAt: now,
        moderatedBy: user.id,
        rejectionReason: null,
        status: 'published',
        submittedAt: previous.submittedAt ?? now,
      })
    }
    if (operation === 'create') return withModeration({ status: 'pending', submittedAt: now })
    return withModeration(previous)
  }

  if (previous.status === 'pending') return withModeration(previous)

  await assertSubmissionSlot(req, user.id)
  return withModeration({ ...previous, rejectionReason: null, status: 'pending', submittedAt: now })
}

/** Queues notification emails when the latest version's status changes (spec §6.2, §10). */
export const notifyTransitions: CollectionAfterChangeHook = async ({
  collection,
  context,
  doc,
  operation,
  previousDoc,
  req,
}) => {
  const user = req.user
  if (isSystem(req) || !user || !isModeratedCollection(collection.slug)) return doc

  const from = operation === 'create' ? undefined : (previousDoc?.moderation as ModerationGroup)?.status
  const to = (doc.moderation as ModerationGroup | undefined)?.status
  if (!to || from === to) return doc

  const authorId = idOf(doc.createdBy)
  const ownEntry = authorId !== null && String(authorId) === String(user.id)
  let event: ModerationEvent | null = null

  if (to === 'pending' && !isModerator(user)) event = { type: 'submitted' }
  else if (to === 'published' && isModerator(user) && !ownEntry) event = { type: 'approved' }
  else if (to === 'rejected' && !ownEntry) {
    event = { reason: (context as ModerationContext).moderationReason, type: 'rejected' }
  }

  const titleField = collection.admin?.useAsTitle ?? 'id'
  let queued = 0
  if (event) {
    try {
      queued = await queueModerationEmails(
        req,
        {
          authorId,
          collection: collection.slug,
          id: doc.id,
          slug: doc.slug,
          submittedAt: doc.moderation?.submittedAt,
          title: String(doc[titleField] ?? doc.id),
        },
        event,
      )
    } catch (err) {
      req.payload.logger.error({ err, id: doc.id }, 'moderation: queueing notification emails failed')
    }
  }

  req.payload.logger.info(
    { collection: collection.slug, emails: queued, from: from ?? null, id: doc.id, to },
    'moderation: status changed',
  )
  return doc
}
