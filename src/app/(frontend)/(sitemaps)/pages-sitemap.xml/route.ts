import { unstable_cache } from 'next/cache'
import { getServerSideSitemap } from 'next-sitemap'

import { getServerSideURL } from '@/utilities/getURL'
import { LISTING_PATHS } from '@/website/listing/params'
import { getPayloadClient, PUBLIC_READ } from '@/website/queries'

const getPagesSitemap = unstable_cache(
  async () => {
    const payload = await getPayloadClient()
    const base = getServerSideURL()
    const { docs } = await payload.find({
      ...PUBLIC_READ,
      collection: 'pages',
      depth: 0,
      limit: 1000,
      pagination: false,
      select: { slug: true, updatedAt: true },
    })

    const now = new Date().toISOString()
    const listings = Object.values(LISTING_PATHS).map((path) => ({
      changefreq: 'daily' as const,
      lastmod: now,
      loc: `${base}${path}`,
    }))
    const pages = docs
      .filter((page) => Boolean(page.slug))
      .map((page) => ({
        lastmod: page.updatedAt,
        loc: page.slug === 'home' ? `${base}/` : `${base}/${page.slug}`,
      }))

    return [...pages, ...listings]
  },
  ['pages-sitemap'],
  { revalidate: 3600, tags: ['pages-sitemap'] },
)

export async function GET() {
  return getServerSideSitemap(await getPagesSitemap())
}
