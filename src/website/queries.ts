import configPromise from '@payload-config'
import { getPayload, type CollectionSlug, type Payload } from 'payload'

import { postponeBuildPrerender } from './staticParams'

/**
 * During `next build`, postpone the render instead of opening MongoDB. At request time this
 * is a normal Local API client, so ISR is unchanged (ADR-033).
 */
export const getPayloadClient = async (): Promise<Payload> => {
  await postponeBuildPrerender()
  return getPayload({ config: configPromise })
}

/** Public website reads: published versions only, through access control as an anonymous visitor. */
export const PUBLIC_READ = { draft: false, overrideAccess: false } as const

export type WebsiteCollection = Extract<
  CollectionSlug,
  'builds' | 'plugins' | 'posts' | 'resources'
>

/** Sort options of the CollectionList block mapped to fields. */
export const COLLECTION_LIST_SORT_FIELDS: Record<
  'builds' | 'plugins' | 'posts',
  Partial<Record<'latest' | 'stars', string>>
> = {
  builds: { latest: '-updatedAt' },
  plugins: { latest: '-createdAt', stars: '-stars' },
  posts: { latest: '-date' },
}
