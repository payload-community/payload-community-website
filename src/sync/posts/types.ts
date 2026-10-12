import type { Payload } from 'payload'

import type { Source } from '@/payload-types'

/** A post from a source, mapped to the Posts fields an adapter owns. */
export type NormalizedPost = {
  author?: string
  date: string
  externalId: string
  image?: { alt?: string; url: string }
  slug: string
  summary?: string
  tags: string[]
  title: string
  url: string
}

export type AdapterContext = {
  fetch: typeof fetch
  /** External IDs already imported from this source; adapters stop paginating once a page has none new. */
  knownExternalIds: Set<string>
  logger: Payload['logger']
}

export type AdapterResult = {
  items: NormalizedPost[]
  /** Items the adapter left out on purpose (e.g. future-dated or without a public page). */
  skipped: number
}

/** One adapter per source type; adding a source type only needs a new adapter (brief, Sources). */
export interface PostSourceAdapter {
  fetchItems(source: Source, ctx: AdapterContext): Promise<AdapterResult>
  type: Source['type']
}
