import type { Where } from 'payload'

import {
  normalizeQuery,
  type BuildsParams,
  type NewsParams,
  type PluginsParams,
  type ResourcesParams,
} from './params'

export type ListingQuery = { sort: string | string[]; where: Where }

const and = (...conditions: (Where | null)[]): Where => {
  const list = conditions.filter((c): c is Where => c !== null)
  return list.length ? { and: list } : {}
}

const search = (q: string, fields: string[]): Where | null => {
  const text = normalizeQuery(q)
  if (!text) return null
  return { or: fields.map((field) => ({ [field]: { like: text } })) }
}

const equals = (field: string, value: string | null): Where | null =>
  value ? { [field]: { equals: value } } : null

/** Same-day ties are broken by the newest document. */
const ENTRY_SORT = { newest: ['-createdAt'], updated: ['-updatedAt', '-createdAt'] } as const

export const newsQuery = (params: NewsParams): ListingQuery => ({
  sort: ['-date', '-createdAt'],
  where: and(
    search(params.q, ['title', 'summary']),
    equals('source', params.source),
    equals('tags', params.tag),
  ),
})

export const resourcesQuery = (params: ResourcesParams): ListingQuery => ({
  sort: [...ENTRY_SORT[params.sort]],
  where: and(
    search(params.q, ['title', 'description']),
    equals('type', params.type),
    equals('tags', params.tag),
  ),
})

export const pluginsQuery = (params: PluginsParams): ListingQuery => ({
  sort: params.sort === 'stars' ? ['-stars', 'name'] : ['-lastPushedAt', '-updatedAt'],
  where: and(search(params.q, ['name', 'description']), equals('topics', params.topic)),
})

export const buildsQuery = (params: BuildsParams): ListingQuery => ({
  sort: [...ENTRY_SORT[params.sort]],
  where: and(
    search(params.q, ['name', 'description']),
    equals('tags', params.tag),
    equals('basePayloadVersion', params.version),
  ),
})

/** Descending by numeric version segments ("3.100.0" before "3.90.2"). */
export const compareVersionsDesc = (a: string, b: string): number => {
  const pa = a.split(/[.-]/)
  const pb = b.split(/[.-]/)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = Number(pa[i] ?? 0)
    const nb = Number(pb[i] ?? 0)
    if (Number.isNaN(na) || Number.isNaN(nb)) {
      const diff = (pb[i] ?? '').localeCompare(pa[i] ?? '')
      if (diff) return diff
    } else if (na !== nb) {
      return nb - na
    }
  }
  return 0
}
