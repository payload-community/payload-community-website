import type { PaginatedDocs } from 'payload'

import type { Build, Plugin, Post, Resource } from '@/payload-types'

import { getPayloadClient, PUBLIC_READ, type WebsiteCollection } from '../queries'
import { LISTING_PAGE_SIZE, normalizePage } from './params'
import { compareVersionsDesc, type ListingQuery } from './where'

type DocBySlug = { builds: Build; plugins: Plugin; posts: Post; resources: Resource }

export const findListing = async <C extends WebsiteCollection>(
  collection: C,
  query: ListingQuery,
  page: number,
): Promise<PaginatedDocs<DocBySlug[C]>> => {
  const payload = await getPayloadClient()
  return (await payload.find({
    ...PUBLIC_READ,
    collection,
    depth: 1,
    limit: LISTING_PAGE_SIZE,
    page: normalizePage(page),
    sort: query.sort,
    where: query.where,
  })) as unknown as PaginatedDocs<DocBySlug[C]>
}

/** Distinct non-empty values of a field among the entries an anonymous visitor can read. */
export const findFilterValues = async (
  collection: WebsiteCollection,
  field: string,
): Promise<string[]> => {
  const payload = await getPayloadClient()
  const result = await payload.findDistinct({
    collection,
    depth: 0,
    field: field as never,
    overrideAccess: false,
  })
  const values = result.values
    .map((row) => {
      const value = (row as Record<string, unknown>)[field]
      return value !== null && typeof value === 'object' ? String(value) : value
    })
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
  const unique = [...new Set(values)]
  return field === 'basePayloadVersion'
    ? unique.sort(compareVersionsDesc)
    : unique.sort((a, b) => a.localeCompare(b))
}

/** Sources that have at least one visible post. */
export const findPostSources = async (): Promise<{ label: string; value: string }[]> => {
  const payload = await getPayloadClient()
  const ids = await findFilterValues('posts', 'source')
  if (!ids.length) return []
  const { docs } = await payload.find({
    collection: 'sources',
    depth: 0,
    limit: ids.length,
    overrideAccess: false,
    pagination: false,
    select: { name: true },
    sort: 'name',
    where: { id: { in: ids } },
  })
  return docs.map((source) => ({ label: source.name, value: String(source.id) }))
}
