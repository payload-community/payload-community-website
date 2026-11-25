import { getServerSideSitemap } from 'next-sitemap'

import { entrySitemap } from '@/website/sitemap'

const getSitemap = entrySitemap('builds', (slug) => `/builds/${slug}`, 'builds-sitemap')

export const dynamic = 'force-dynamic'

export async function GET() {
  return getServerSideSitemap(await getSitemap())
}
