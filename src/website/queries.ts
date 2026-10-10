import configPromise from '@payload-config'
import { getPayload, type CollectionSlug, type Payload } from 'payload'

export const getPayloadClient = (): Promise<Payload> => getPayload({ config: configPromise })

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
