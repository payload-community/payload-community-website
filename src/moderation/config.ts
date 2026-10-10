import type { CollectionSlug } from 'payload'

export const MAX_PENDING_SUBMISSIONS = 3

export const MODERATION_STATUSES = ['pending', 'published', 'rejected', 'unpublished'] as const
export type ModerationStatus = (typeof MODERATION_STATUSES)[number]

export const MODERATED_COLLECTIONS = ['posts', 'resources', 'plugins', 'builds'] as const satisfies
  readonly CollectionSlug[]
export type ModeratedCollection = (typeof MODERATED_COLLECTIONS)[number]

export const isModeratedCollection = (slug: string): slug is ModeratedCollection =>
  (MODERATED_COLLECTIONS as readonly string[]).includes(slug)

export const MODERATION_ACTIONS = ['approve', 'reject', 'unpublish', 'republish'] as const
export type ModerationAction = (typeof MODERATION_ACTIONS)[number]

/**
 * Latest statuses from which each moderation action is allowed (spec §6.3, T5–T7). `unpublish`
 * is also allowed while a newer draft sits over a published main document.
 */
export const ACTION_FROM: Record<ModerationAction, readonly ModerationStatus[]> = {
  approve: ['pending', 'rejected', 'unpublished'],
  reject: ['pending'],
  republish: ['rejected', 'unpublished'],
  unpublish: ['published'],
}

/** Portal path prefix of each moderated collection (website routes, M4). */
export const PORTAL_PATHS: Record<ModeratedCollection, string> = {
  builds: '/builds',
  plugins: '/plugins',
  posts: '/news',
  resources: '/resources',
}
