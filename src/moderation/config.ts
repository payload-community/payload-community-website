export const MAX_PENDING_SUBMISSIONS = 3

export const MODERATION_STATUSES = ['pending', 'published', 'rejected', 'unpublished'] as const
export type ModerationStatus = (typeof MODERATION_STATUSES)[number]
