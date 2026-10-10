import { getServerSideURL } from '@/utilities/getURL'
import { SITEMAP_PATHS } from '@/website/sitemap'

export const dynamic = 'force-dynamic'

const DISALLOW = ['/admin', '/api/', '/account', '/next/', '/sign-in', '/submit/']

/** Rendered at request time so it uses the deployment's public URL. */
export function GET() {
  const base = getServerSideURL()
  const body = [
    'User-agent: *',
    ...DISALLOW.map((path) => `Disallow: ${path}`),
    '',
    `Sitemap: ${base}/sitemap.xml`,
    ...SITEMAP_PATHS.map((path) => `Sitemap: ${base}${path}`),
    '',
  ].join('\n')
  return new Response(body, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}
