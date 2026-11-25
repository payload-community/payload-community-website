/**
 * Next replaces a direct `process.env.NEXT_PUBLIC_*` read with the build-time value.
 * Indexing `process.env` keeps the read on the server at request time (ADR-013).
 */
export const publicEnv = (
  name: 'NEXT_PUBLIC_GA_MEASUREMENT_ID' | 'NEXT_PUBLIC_SERVER_URL',
): string => process.env[name] ?? ''
