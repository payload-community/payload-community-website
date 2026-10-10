import type { SiteConfig } from '@/website/consent/types'

/** Runtime settings for client components; pages stay static (ADR-028). */
export const dynamic = 'force-dynamic'

export function GET(): Response {
  const config: SiteConfig = {
    gaMeasurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || null,
  }

  return Response.json(config, { headers: { 'Cache-Control': 'public, max-age=300' } })
}
