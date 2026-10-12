import type { Payload } from 'payload'

import type { Post, Source } from '@/payload-types'

import { changedFields, SYNC_CONTEXT, updateSyncedEntry } from '../write'
import { postSourceAdapters } from './adapters'
import { ensurePostImage } from './images'
import type { NormalizedPost } from './types'

export type SourceSyncStats = {
  created: number
  failed: number
  imageFailures: number
  skipped: number
  unchanged: number
  updated: number
}

export type SourceSyncResult = SourceSyncStats & {
  error?: string
  source: string
  status: NonNullable<Source['lastSyncStatus']>
}

export type SyncPostsOptions = {
  fetch?: typeof fetch
  sourceId?: number | string
}

const emptyStats = (): SourceSyncStats => ({
  created: 0,
  failed: 0,
  imageFailures: 0,
  skipped: 0,
  unchanged: 0,
  updated: 0,
})

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err))

async function upsertPost(
  payload: Payload,
  source: Source,
  item: NormalizedPost,
  stats: SourceSyncStats,
  fetchImpl: typeof fetch,
): Promise<void> {
  const { docs } = await payload.find({
    collection: 'posts',
    depth: 0,
    draft: true,
    limit: 1,
    pagination: false,
    where: { url: { equals: item.url } },
  })
  const existing = docs[0] as Post | undefined

  let image: string | null = null
  if (item.image) {
    try {
      image = await ensurePostImage(payload, item.image, item.title, fetchImpl)
    } catch (err) {
      stats.imageFailures++
      payload.logger.warn(
        { err: errorMessage(err), url: item.image.url },
        'sync posts: image download failed',
      )
      image = existing && typeof existing.image === 'string' ? existing.image : null
    }
  }

  const fields = {
    author: item.author ?? null,
    date: item.date,
    externalId: item.externalId,
    image,
    source: String(source.id),
    summary: item.summary ?? null,
    tags: item.tags,
    title: item.title,
    url: item.url,
  }

  if (!existing) {
    await payload.create({
      collection: 'posts',
      context: SYNC_CONTEXT,
      // `moderation` is computed by the shared hooks (`published` for system creates).
      data: { ...fields, _status: 'published', origin: 'imported', slug: item.slug } as never,
      draft: false,
    })
    stats.created++
    return
  }

  const current = { ...existing, source: idOf(existing.source), image: idOf(existing.image) }
  const changes = changedFields(current, fields)
  if (Object.keys(changes).length === 0) {
    stats.unchanged++
    return
  }
  await updateSyncedEntry(payload, 'posts', existing.id, changes)
  stats.updated++
}

const idOf = (value: unknown): string | null => {
  if (value && typeof value === 'object' && 'id' in value)
    return String((value as { id: unknown }).id)
  return value == null ? null : String(value)
}

/** Imports one source through its adapter and records the result on the source (spec §11.1). */
export async function syncSource(
  payload: Payload,
  source: Source,
  fetchImpl: typeof fetch = fetch,
): Promise<SourceSyncResult> {
  const stats = emptyStats()
  let status: SourceSyncResult['status'] = 'success'
  let error: string | undefined

  try {
    const adapter = postSourceAdapters[source.type]
    if (!adapter) throw new Error(`No adapter for source type "${source.type}"`)

    const known = await payload.find({
      collection: 'posts',
      depth: 0,
      draft: true,
      pagination: false,
      select: { externalId: true },
      where: { source: { equals: source.id } },
    })
    const knownExternalIds = new Set(
      known.docs.map((doc) => doc.externalId).filter((id): id is string => Boolean(id)),
    )

    const { items, skipped } = await adapter.fetchItems(source, {
      fetch: fetchImpl,
      knownExternalIds,
      logger: payload.logger,
    })
    stats.skipped = skipped

    for (const item of items) {
      try {
        await upsertPost(payload, source, item, stats, fetchImpl)
      } catch (err) {
        stats.failed++
        payload.logger.error(
          { err: errorMessage(err), externalId: item.externalId, source: source.name },
          'sync posts: item failed',
        )
      }
    }
    if (stats.failed > 0) status = 'partial'
  } catch (err) {
    status = 'failed'
    error = errorMessage(err)
  }

  await payload.update({
    collection: 'sources',
    context: SYNC_CONTEXT,
    data: {
      lastSyncedAt: new Date().toISOString(),
      lastSyncError: error ?? null,
      lastSyncStats: stats,
      lastSyncStatus: status,
    },
    id: source.id,
  })

  return { ...stats, error, source: source.name, status }
}

/** Syncs every enabled source (or one source by ID) one after another. */
export async function syncPosts(
  payload: Payload,
  options: SyncPostsOptions = {},
): Promise<SourceSyncResult[]> {
  const { docs: sources } = await payload.find({
    collection: 'sources',
    depth: 0,
    pagination: false,
    where: options.sourceId ? { id: { equals: options.sourceId } } : { enabled: { equals: true } },
  })

  const results: SourceSyncResult[] = []
  for (const source of sources) results.push(await syncSource(payload, source, options.fetch))
  return results
}
