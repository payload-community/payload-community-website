import { getServerSideSitemap } from 'next-sitemap'

import { entrySitemap } from '@/website/sitemap'

const getSitemap = entrySitemap('plugins', (slug) => `/plugins/${slug}`, 'plugins-sitemap')

export async function GET() {
  return getServerSideSitemap(await getSitemap())
}
