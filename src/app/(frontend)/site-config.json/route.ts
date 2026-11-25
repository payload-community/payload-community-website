import type { SiteConfig } from '@/website/consent/types'
import { publicEnv } from '@/utilities/publicEnv'

/** Runtime settings for client components; pages stay static (ADR-028). */
export const dynamic = 'force-dynamic'

export function GET(): Response {
  const gaMeasurementId = publicEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID')
  const config: SiteConfig = {
    gaMeasurementId: gaMeasurementId || null,
  }

  return Response.json(config, { headers: { 'Cache-Control': 'public, max-age=300' } })
}
