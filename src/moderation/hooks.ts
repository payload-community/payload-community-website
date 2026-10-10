import type { CollectionBeforeChangeHook } from 'payload'

import { isSystem } from '@/access'

/** Sets `createdBy` to the signed-in user on create. System requests may pass their own value. */
export const setCreatedBy: CollectionBeforeChangeHook = ({ data, operation, req }) => {
  if (operation !== 'create' || isSystem(req)) return data
  return { ...data, createdBy: req.user?.id ?? null }
}

/**
 * Sets `createdBy` and `origin` on create. System requests (sync jobs, seeds) may pass `origin`;
 * otherwise they get `systemOrigin`. Users always get `userOrigin`.
 */
export const setOwnership =
  ({ systemOrigin, userOrigin }: { systemOrigin: string; userOrigin: string }): CollectionBeforeChangeHook =>
  (args) => {
    const { data, operation, req } = args
    if (operation !== 'create') return data

    if (isSystem(req)) return { ...data, origin: data.origin ?? systemOrigin }

    return { ...setCreatedBy(args), origin: userOrigin }
  }
