import type { CollectionSlug, Payload, RequestContext } from 'payload'

/** Sync writes bypass moderation (`isSystem`) and keep the status of existing entries. */
export const SYNC_CONTEXT: RequestContext = { system: true }

type SyncedCollection = Extract<CollectionSlug, 'plugins' | 'posts'>

/** Fields in `next` whose values differ from `current` (deep comparison through JSON). */
export const changedFields = <T extends Record<string, unknown>>(
  current: object,
  next: T,
): Partial<T> => {
  const normalize = (value: unknown) => JSON.stringify(value ?? null)
  const values = current as Record<string, unknown>
  return Object.fromEntries(
    Object.entries(next).filter(([key, value]) => normalize(values[key]) !== normalize(value)),
  ) as Partial<T>
}

/**
 * Writes sync-owned fields without publishing anyone's draft (spec §11.3, ADR-012). When the
 * latest version is the published one, a normal published update is enough. Otherwise (a pending
 * or rejected edit, or an unpublished entry) the main document is patched directly, without hooks
 * or a new version, and the latest draft gets the same values as a draft update.
 */
export async function updateSyncedEntry(
  payload: Payload,
  collection: SyncedCollection,
  id: number | string,
  data: Record<string, unknown>,
): Promise<void> {
  const latest = await payload.findByID({ collection, depth: 0, draft: true, id })
  if (latest._status === 'published') {
    await payload.update({
      collection,
      context: SYNC_CONTEXT,
      data: { ...data, _status: 'published' },
      depth: 0,
      draft: false,
      id,
    })
    return
  }

  await payload.db.updateOne({ collection, data, id })
  await payload.update({ collection, context: SYNC_CONTEXT, data, depth: 0, draft: true, id })
}
