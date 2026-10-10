import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { safeRevalidate } from '@/website/revalidate'

type Doc = { _status?: string | null; origin?: string | null; slug?: string | null }

const SECTIONS: Record<string, { detail: (doc: Doc) => string | null; sitemapTag: string }> = {
  builds: { detail: (doc) => `/builds/${doc.slug}`, sitemapTag: 'builds-sitemap' },
  plugins: { detail: (doc) => `/plugins/${doc.slug}`, sitemapTag: 'plugins-sitemap' },
  posts: {
    detail: (doc) => (doc.origin === 'imported' ? null : `/news/${doc.slug}`),
    sitemapTag: 'news-sitemap',
  },
  resources: { detail: (doc) => `/resources/${doc.slug}`, sitemapTag: 'resources-sitemap' },
}

const pathsFor = (collection: string, docs: (Doc | null | undefined)[]): string[] => {
  const section = SECTIONS[collection]
  if (!section) return []
  const details = docs
    .filter((doc): doc is Doc => Boolean(doc?.slug))
    .map((doc) => section.detail(doc))
    .filter((path): path is string => path !== null)
  return ['/', ...new Set(details)]
}

/** Published entries (or entries that just stopped being published) refresh their pages and the home page. */
export const revalidateEntry: CollectionAfterChangeHook = ({
  collection,
  doc,
  previousDoc,
  req,
}) => {
  if (req.context.disableRevalidate) return doc
  const wasPublished = previousDoc?._status === 'published'
  if (doc._status !== 'published' && !wasPublished) return doc
  safeRevalidate(req.payload, {
    paths: pathsFor(collection.slug, [doc, wasPublished ? previousDoc : null]),
    tags: [SECTIONS[collection.slug]?.sitemapTag].filter((tag): tag is string => Boolean(tag)),
  })
  return doc
}

export const revalidateDeletedEntry: CollectionAfterDeleteHook = ({ collection, doc, req }) => {
  if (req.context.disableRevalidate || doc?._status !== 'published') return doc
  safeRevalidate(req.payload, {
    paths: pathsFor(collection.slug, [doc]),
    tags: [SECTIONS[collection.slug]?.sitemapTag].filter((tag): tag is string => Boolean(tag)),
  })
  return doc
}
