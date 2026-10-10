import { draftMode, headers } from 'next/headers'
import { cache } from 'react'
import type { Where } from 'payload'

import type { Build, Plugin, Post, Resource } from '@/payload-types'

import { getPayloadClient, PUBLIC_READ, type WebsiteCollection } from './queries'

type DocBySlug = { builds: Build; plugins: Plugin; posts: Post; resources: Resource }

/** Imported posts link to their source site; only community posts have a page here. */
const DETAIL_FILTER: Partial<Record<WebsiteCollection, Where>> = {
  posts: { origin: { equals: 'community' } },
}

const STATIC_PARAMS_LIMIT = 1000

/**
 * A published entry by slug as an anonymous visitor sees it, or `null`. In draft mode (live
 * preview) the signed-in user's latest draft is returned, still through access control.
 */
export const findEntryBySlug = cache(
  async <C extends WebsiteCollection>(
    collection: C,
    slug: string,
  ): Promise<DocBySlug[C] | null> => {
    const payload = await getPayloadClient()
    const { isEnabled: draft } = await draftMode()
    const user = draft ? (await payload.auth({ headers: await headers() })).user : null
    const filter = DETAIL_FILTER[collection]
    const { docs } = await payload.find({
      ...PUBLIC_READ,
      ...(draft && user ? { draft: true, user } : {}),
      collection,
      depth: 1,
      limit: 1,
      pagination: false,
      where: { and: [{ slug: { equals: decodeURIComponent(slug) } }, ...(filter ? [filter] : [])] },
    })
    return (docs[0] as DocBySlug[C] | undefined) ?? null
  },
)

/** Slugs prerendered at build time; newer entries render on first request. */
export const entrySlugs = async (collection: WebsiteCollection): Promise<{ slug: string }[]> => {
  const payload = await getPayloadClient()
  const filter = DETAIL_FILTER[collection]
  const { docs } = await payload.find({
    ...PUBLIC_READ,
    collection,
    depth: 0,
    limit: STATIC_PARAMS_LIMIT,
    pagination: false,
    select: { slug: true },
    sort: '-updatedAt',
    ...(filter ? { where: filter } : {}),
  })
  return docs
    .map((doc) => (doc as { slug?: string | null }).slug)
    .filter((slug): slug is string => Boolean(slug))
    .map((slug) => ({ slug }))
}
