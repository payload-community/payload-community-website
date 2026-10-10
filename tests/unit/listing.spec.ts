import { describe, expect, it } from 'vitest'

import {
  hasActiveFilters,
  listingHref,
  listingLoaders,
  MAX_QUERY_LENGTH,
  normalizePage,
  normalizeQuery,
  paginationItems,
} from '@/website/listing/params'
import {
  buildsQuery,
  compareVersionsDesc,
  newsQuery,
  pluginsQuery,
  resourcesQuery,
} from '@/website/listing/where'

describe('listing params', () => {
  it('applies defaults and drops invalid values', () => {
    expect(listingLoaders.resources('?type=bogus&page=x&sort=nope')).toEqual({
      page: 1,
      q: '',
      sort: 'updated',
      tag: null,
      type: null,
    })
    expect(listingLoaders.plugins('?topic=seo&sort=updated&page=3')).toEqual({
      page: 3,
      q: '',
      sort: 'updated',
      topic: 'seo',
    })
  })

  it('normalizes the search text and page', () => {
    expect(normalizeQuery('   ')).toBeNull()
    expect(normalizeQuery('  seo plugin ')).toBe('seo plugin')
    expect(normalizeQuery('x'.repeat(500))).toHaveLength(MAX_QUERY_LENGTH)
    expect(normalizePage(0)).toBe(1)
    expect(normalizePage(-4)).toBe(1)
    expect(normalizePage(Number.NaN)).toBe(1)
    expect(normalizePage(2.7)).toBe(2)
  })

  it('treats empty fields and defaults as no filter', () => {
    expect(
      hasActiveFilters('plugins', listingLoaders.plugins('?q=&topic=&sort=stars&page=4')),
    ).toBe(false)
    expect(hasActiveFilters('plugins', listingLoaders.plugins('?sort=updated'))).toBe(true)
    expect(hasActiveFilters('news', listingLoaders.news('?q=release'))).toBe(true)
  })

  it('builds page links that keep filters and drop empty values', () => {
    const params = listingLoaders.builds('?q=&tag=auth&version=3.90.2&page=2')
    expect(listingHref('builds', params, 3)).toBe('/builds?page=3&tag=auth&version=3.90.2')
    expect(listingHref('builds', params, 1)).toBe('/builds?tag=auth&version=3.90.2')
    expect(listingHref('news', listingLoaders.news(''), 1)).toBe('/news')
  })
})

describe('listing queries', () => {
  it('searches title and summary and filters news by source and tag', () => {
    expect(newsQuery(listingLoaders.news('?q=%20release%20&source=abc&tag=Guides'))).toEqual({
      sort: ['-date', '-createdAt'],
      where: {
        and: [
          { or: [{ title: { like: 'release' } }, { summary: { like: 'release' } }] },
          { source: { equals: 'abc' } },
          { tags: { equals: 'Guides' } },
        ],
      },
    })
  })

  it('returns an empty where clause without filters', () => {
    expect(newsQuery(listingLoaders.news('')).where).toEqual({})
  })

  it('filters resources by type and sorts by the chosen order', () => {
    const query = resourcesQuery(listingLoaders.resources('?type=video&sort=newest'))
    expect(query.where).toEqual({ and: [{ type: { equals: 'video' } }] })
    expect(query.sort).toEqual(['-createdAt'])
    expect(resourcesQuery(listingLoaders.resources('')).sort).toEqual(['-updatedAt', '-createdAt'])
  })

  it('sorts plugins by stars by default and by last push on request', () => {
    expect(pluginsQuery(listingLoaders.plugins('')).sort).toEqual(['-stars', 'name'])
    expect(pluginsQuery(listingLoaders.plugins('?sort=updated&topic=seo'))).toEqual({
      sort: ['-lastPushedAt', '-updatedAt'],
      where: { and: [{ topics: { equals: 'seo' } }] },
    })
  })

  it('filters builds by base Payload version', () => {
    expect(buildsQuery(listingLoaders.builds('?version=3.90.2')).where).toEqual({
      and: [{ basePayloadVersion: { equals: '3.90.2' } }],
    })
  })

  it('orders versions numerically, newest first', () => {
    expect(['3.9.0', '3.100.0', '3.90.2', '2.30.0'].sort(compareVersionsDesc)).toEqual([
      '3.100.0',
      '3.90.2',
      '3.9.0',
      '2.30.0',
    ])
  })
})

describe('paginationItems', () => {
  it('shows every page when there are few', () => {
    expect(paginationItems(1, 1)).toEqual([1])
    expect(paginationItems(2, 3)).toEqual([1, 2, 3])
  })

  it('collapses distant pages into gaps', () => {
    expect(paginationItems(1, 10)).toEqual([1, 2, null, 10])
    expect(paginationItems(5, 10)).toEqual([1, null, 4, 5, 6, null, 10])
    expect(paginationItems(10, 10)).toEqual([1, null, 9, 10])
  })
})
