import { getServerSideSitemap } from 'next-sitemap'

import { entrySitemap } from '@/website/sitemap'

const getSitemap = entrySitemap('resources', (slug) => `/resources/${slug}`, 'resources-sitemap')

export async function GET() {
  return getServerSideSitemap(await getSitemap())
}
