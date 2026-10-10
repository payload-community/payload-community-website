import { getServerSideSitemapIndex } from 'next-sitemap'

import { getServerSideURL } from '@/utilities/getURL'
import { SITEMAP_PATHS } from '@/website/sitemap'

export const dynamic = 'force-dynamic'

/** Sitemap index, rendered at request time so it uses the deployment's public URL. */
export async function GET() {
  const base = getServerSideURL()
  return getServerSideSitemapIndex(SITEMAP_PATHS.map((path) => `${base}${path}`))
}
