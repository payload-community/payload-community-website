import { unstable_cache } from 'next/cache'
import type { ISitemapField } from 'next-sitemap'
import type { Where } from 'payload'

import { getServerSideURL } from '@/utilities/getURL'

import { getPayloadClient, PUBLIC_READ, type WebsiteCollection } from './queries'

export const SITEMAP_LIMIT = 5000

/** Section sitemaps listed in `/sitemap.xml` and `robots.txt`; each is a route handler. */
export const SITEMAP_PATHS = [
  '/pages-sitemap.xml',
  '/news-sitemap.xml',
  '/resources-sitemap.xml',
  '/plugins-sitemap.xml',
  '/builds-sitemap.xml',
] as const

/** Published entries of a collection, cached until the moderation hooks revalidate `tag`. */
export const entrySitemap = (
  collection: WebsiteCollection,
  pathFor: (slug: string) => string,
  tag: string,
  where?: Where,
) =>
  unstable_cache(
    async (): Promise<ISitemapField[]> => {
      const payload = await getPayloadClient()
      const base = getServerSideURL()
      const { docs } = await payload.find({
        ...PUBLIC_READ,
        collection,
        depth: 0,
        limit: SITEMAP_LIMIT,
        pagination: false,
        select: { slug: true, updatedAt: true },
        sort: '-updatedAt',
        ...(where ? { where } : {}),
      })
      return docs
        .map((doc) => doc as { slug?: string | null; updatedAt: string })
        .filter((doc) => Boolean(doc.slug))
        .map((doc) => ({ lastmod: doc.updatedAt, loc: `${base}${pathFor(doc.slug!)}` }))
    },
    [tag],
    { revalidate: 3600, tags: [tag] },
  )
