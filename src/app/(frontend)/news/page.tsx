import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { SearchParams } from 'nuqs/server'
import React from 'react'

import { initLingui } from '@/lingui/server'
import { PostCard, postHref } from '@/website/cards'
import {
  EmptyState,
  FilterForm,
  ItemListJsonLd,
  ListingGrid,
  ListingHeader,
  Pagination,
  ResultCount,
  SelectField,
} from '@/website/listing/components'
import { FILTER_LABELS, LISTING_COPY } from '@/website/listing/copy'
import { findFilterValues, findListing, findPostSources } from '@/website/listing/data'
import { listingMetadata } from '@/website/listing/metadata'
import { hasActiveFilters, listingHref, listingLoaders } from '@/website/listing/params'
import { newsQuery } from '@/website/listing/where'

type Args = { searchParams: Promise<SearchParams> }

export async function generateMetadata({ searchParams }: Args): Promise<Metadata> {
  return listingMetadata('news', await listingLoaders.news(searchParams))
}

export default async function NewsPage({ searchParams }: Args) {
  const i18n = initLingui()
  const params = await listingLoaders.news(searchParams)
  const copy = LISTING_COPY.news
  const filtered = hasActiveFilters('news', params)

  const [result, sources, tags] = await Promise.all([
    findListing('posts', newsQuery(params), params.page),
    findPostSources(),
    findFilterValues('posts', 'tags'),
  ])
  if (!result.docs.length && result.totalDocs > 0) notFound()

  return (
    <div className="container py-16">
      <ListingHeader
        action={{ href: '/submit/posts', label: i18n._(copy.submit) }}
        description={i18n._(copy.description)}
        title={i18n._(copy.title)}
      />
      <FilterForm
        action="/news"
        hasActiveFilters={filtered}
        q={params.q}
        searchLabel={i18n._(copy.search)}
      >
        {sources.length > 0 && (
          <SelectField
            emptyLabel={i18n._(FILTER_LABELS.allSources)}
            label={i18n._(FILTER_LABELS.source)}
            name="source"
            options={sources}
            value={params.source}
          />
        )}
        {tags.length > 0 && (
          <SelectField
            emptyLabel={i18n._(FILTER_LABELS.allTags)}
            label={i18n._(FILTER_LABELS.tag)}
            name="tag"
            options={tags.map((tag) => ({ label: tag, value: tag }))}
            value={params.tag}
          />
        )}
      </FilterForm>
      <ResultCount total={result.totalDocs} />
      {result.docs.length ? (
        <ListingGrid testId="news-list">
          {result.docs.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </ListingGrid>
      ) : (
        <EmptyState filtered={filtered} />
      )}
      <Pagination
        hrefFor={(page) => listingHref('news', params, page)}
        page={result.page ?? 1}
        totalPages={result.totalPages}
      />
      <ItemListJsonLd
        items={result.docs.map((post) => ({ name: post.title, url: postHref(post) }))}
        name={i18n._(copy.title)}
        startIndex={result.pagingCounter}
      />
    </div>
  )
}
