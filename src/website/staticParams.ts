/**
 * `next build` sets this phase. Detail and page slugs are not queried then, so an image
 * build has no database. The first request renders the page and ISR caches it (ADR-033).
 */
export const isProductionBuild = (): boolean => process.env.NEXT_PHASE === 'phase-production-build'

/** Stops a static prerender before it opens MongoDB. No effect at request time. */
export const postponeBuildPrerender = async (): Promise<void> => {
  if (!isProductionBuild()) return
  const { connection } = await import('next/server')
  await connection()
}
