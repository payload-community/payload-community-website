import { getServerSideSitemap } from 'next-sitemap'

import { entrySitemap } from '@/website/sitemap'

const getSitemap = entrySitemap('posts', (slug) => `/news/${slug}`, 'news-sitemap', {
  origin: { equals: 'community' },
})

export async function GET() {
  return getServerSideSitemap(await getSitemap())
}
