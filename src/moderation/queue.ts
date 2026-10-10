import type { Payload, TypedUser } from 'payload'

import { MODERATED_COLLECTIONS, type ModeratedCollection, type ModerationStatus } from './config'

export const QUEUE_TABS = ['pending', 'rejected', 'unpublished'] as const satisfies readonly ModerationStatus[]
export type QueueTab = (typeof QUEUE_TABS)[number]
export const QUEUE_PAGE_SIZE = 50

export type QueueRow = {
  author: string | null
  collection: ModeratedCollection
  id: number | string
  moderatedAt: string | null
  rejectionReason: string | null
  status: ModerationStatus
  submittedAt: string | null
  title: string
}

type Author = { githubLogin?: string | null; name?: string | null } | number | string | null | undefined

const authorName = (author: Author) =>
  author && typeof author === 'object' ? author.name || author.githubLogin || null : null

/** Number of entries whose latest version has `status`, per collection (moderator access). */
export async function countByStatus(
  payload: Payload,
  user: TypedUser,
  status: ModerationStatus,
): Promise<Record<ModeratedCollection, number>> {
  const entries = await Promise.all(
    MODERATED_COLLECTIONS.map(async (collection) => {
      const { totalDocs } = await payload.find({
        collection,
        depth: 0,
        draft: true,
        limit: 1,
        overrideAccess: false,
        select: {},
        user,
        where: { 'moderation.status': { equals: status } },
      })
      return [collection, totalDocs] as const
    }),
  )
  return Object.fromEntries(entries) as Record<ModeratedCollection, number>
}

/**
 * One merged list of the four collections for a dashboard tab (spec §8). Pending entries are
 * oldest first; rejected and unpublished entries are most recently moderated first.
 */
export async function loadQueue(
  payload: Payload,
  user: TypedUser,
  tab: QueueTab,
  page = 1,
): Promise<{ rows: QueueRow[]; total: number }> {
  const oldestFirst = tab === 'pending'
  const take = page * QUEUE_PAGE_SIZE

  const results = await Promise.all(
    MODERATED_COLLECTIONS.map(async (collection) => {
      const titleField = payload.collections[collection].config.admin.useAsTitle ?? 'id'
      const { docs, totalDocs } = await payload.find({
        collection,
        depth: 1,
        draft: true,
        limit: take,
        overrideAccess: false,
        sort: oldestFirst ? 'moderation.submittedAt' : '-moderation.moderatedAt',
        user,
        where: { 'moderation.status': { equals: tab } },
      })
      const rows = docs.map((doc): QueueRow => {
        const record = doc as unknown as Record<string, unknown>
        return {
          author: authorName(doc.createdBy as Author),
          collection,
          id: doc.id,
          moderatedAt: doc.moderation?.moderatedAt ?? null,
          rejectionReason: doc.moderation?.rejectionReason ?? null,
          status: doc.moderation?.status ?? tab,
          submittedAt: doc.moderation?.submittedAt ?? null,
          title: String(record[titleField] || doc.id),
        }
      })
      return { rows, totalDocs }
    }),
  )

  const key = (row: QueueRow) => (oldestFirst ? row.submittedAt : row.moderatedAt) ?? ''
  const rows = results
    .flatMap((result) => result.rows)
    .sort((a, b) => (oldestFirst ? key(a).localeCompare(key(b)) : key(b).localeCompare(key(a))))
    .slice(take - QUEUE_PAGE_SIZE, take)

  return { rows, total: results.reduce((sum, result) => sum + result.totalDocs, 0) }
}
