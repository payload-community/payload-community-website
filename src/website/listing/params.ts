import {
  createLoader,
  createSerializer,
  type inferParserType,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from 'nuqs/server'

import type { Resource } from '@/payload-types'

export const LISTING_PAGE_SIZE = 24
export const MAX_QUERY_LENGTH = 100

export const RESOURCE_TYPE_VALUES = [
  'blog',
  'community',
  'course',
  'docs',
  'other',
  'tool',
  'video',
  'website',
] as const satisfies readonly Resource['type'][]

export const PLUGIN_SORTS = ['stars', 'updated'] as const
export const ENTRY_SORTS = ['updated', 'newest'] as const

const common = {
  page: parseAsInteger.withDefault(1),
  q: parseAsString.withDefault(''),
}

export const listingParsers = {
  builds: {
    ...common,
    sort: parseAsStringLiteral(ENTRY_SORTS).withDefault('updated'),
    tag: parseAsString,
    version: parseAsString,
  },
  news: { ...common, source: parseAsString, tag: parseAsString },
  plugins: {
    ...common,
    sort: parseAsStringLiteral(PLUGIN_SORTS).withDefault('stars'),
    topic: parseAsString,
  },
  resources: {
    ...common,
    sort: parseAsStringLiteral(ENTRY_SORTS).withDefault('updated'),
    tag: parseAsString,
    type: parseAsStringLiteral(RESOURCE_TYPE_VALUES),
  },
}

export type ListingSection = keyof typeof listingParsers

export const listingLoaders = {
  builds: createLoader(listingParsers.builds),
  news: createLoader(listingParsers.news),
  plugins: createLoader(listingParsers.plugins),
  resources: createLoader(listingParsers.resources),
}

export const listingSerializers = {
  builds: createSerializer(listingParsers.builds),
  news: createSerializer(listingParsers.news),
  plugins: createSerializer(listingParsers.plugins),
  resources: createSerializer(listingParsers.resources),
}

export type BuildsParams = inferParserType<typeof listingParsers.builds>
export type NewsParams = inferParserType<typeof listingParsers.news>
export type PluginsParams = inferParserType<typeof listingParsers.plugins>
export type ResourcesParams = inferParserType<typeof listingParsers.resources>

/** Trimmed, length-limited search text, or `null` when empty. */
export const normalizeQuery = (q: string): string | null => {
  const trimmed = q.trim().slice(0, MAX_QUERY_LENGTH)
  return trimmed || null
}

/** Page numbers below 1 (or garbage) fall back to the first page. */
export const normalizePage = (page: number): number =>
  Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1

export const LISTING_PATHS: Record<ListingSection, string> = {
  builds: '/builds',
  news: '/news',
  plugins: '/plugins',
  resources: '/resources',
}

export type ListingParams = Record<string, unknown> & { page: number }

/** Empty form fields (`?tag=`) count as unset. */
const withoutEmpty = (params: ListingParams): ListingParams =>
  Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, value === '' ? null : value]),
  ) as ListingParams

/** True when search text, a filter or a non-default sort is set (pagination aside). */
export const hasActiveFilters = (section: ListingSection, params: ListingParams): boolean =>
  (listingSerializers[section] as (p: ListingParams) => string)({
    ...withoutEmpty(params),
    page: 1,
  }) !== ''

/** URL of the same listing with other params kept and `page` replaced. */
export const listingHref = (section: ListingSection, params: ListingParams, page: number): string =>
  (listingSerializers[section] as (base: string, p: ListingParams) => string)(
    LISTING_PATHS[section],
    {
      ...withoutEmpty(params),
      page,
    },
  )

/** Page numbers to show: first, last, and a window around the current page; `null` is a gap. */
export const paginationItems = (page: number, totalPages: number): (number | null)[] => {
  const pages = new Set([1, totalPages, page - 1, page, page + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)
  const items: (number | null)[] = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) items.push(null)
    items.push(p)
  })
  return items
}
