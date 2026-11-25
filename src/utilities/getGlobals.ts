import type { Config } from 'src/payload-types'

import { type DataFromGlobalSlug } from 'payload'
import { unstable_cache } from 'next/cache'

import { getPayloadClient } from '@/website/queries'
import { postponeBuildPrerender } from '@/website/staticParams'

type Global = keyof Config['globals']

async function getGlobal<T extends Global>(slug: T, depth = 0): Promise<DataFromGlobalSlug<T>> {
  const payload = await getPayloadClient()

  const global = await payload.findGlobal({
    slug,
    depth,
  })

  return global
}

/**
 * Returns a unstable_cache function mapped with the cache tag for the slug
 */
export const getCachedGlobal = <T extends Global>(slug: T, depth = 0) => {
  const cached = unstable_cache(async () => getGlobal<T>(slug, depth), [slug], {
    tags: [`global_${slug}`],
  })
  return async () => {
    await postponeBuildPrerender()
    return cached()
  }
}
