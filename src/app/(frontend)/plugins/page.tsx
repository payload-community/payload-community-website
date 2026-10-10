import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { SearchParams } from 'nuqs/server'
import React from 'react'

import { initLingui } from '@/lingui/server'
import { PluginCard } from '@/website/cards'
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
import { findFilterValues, findListing } from '@/website/listing/data'
import { listingMetadata } from '@/website/listing/metadata'
import { hasActiveFilters, listingHref, listingLoaders } from '@/website/listing/params'
import { pluginsQuery } from '@/website/listing/where'

type Args = { searchParams: Promise<SearchParams> }

export async function generateMetadata({ searchParams }: Args): Promise<Metadata> {
  return listingMetadata('plugins', await listingLoaders.plugins(searchParams))
}

export default async function PluginsPage({ searchParams }: Args) {
  const i18n = initLingui()
  const params = await listingLoaders.plugins(searchParams)
  const copy = LISTING_COPY.plugins
  const filtered = hasActiveFilters('plugins', params)

  const [result, topics] = await Promise.all([
    findListing('plugins', pluginsQuery(params), params.page),
    findFilterValues('plugins', 'topics'),
  ])
  if (!result.docs.length && result.totalDocs > 0) notFound()

  return (
    <div className="container py-16">
      <ListingHeader
        action={{ href: '/submit/plugins', label: i18n._(copy.submit) }}
        description={i18n._(copy.description)}
        title={i18n._(copy.title)}
      />
      <FilterForm
        action="/plugins"
        hasActiveFilters={filtered}
        q={params.q}
        searchLabel={i18n._(copy.search)}
      >
        {topics.length > 0 && (
          <SelectField
            emptyLabel={i18n._(FILTER_LABELS.allTopics)}
            label={i18n._(FILTER_LABELS.topic)}
            name="topic"
            options={topics.map((topic) => ({ label: topic, value: topic }))}
            value={params.topic}
          />
        )}
        <SelectField
          label={i18n._(FILTER_LABELS.sort)}
          name="sort"
          options={[
            { label: i18n._(FILTER_LABELS.stars), value: 'stars' },
            { label: i18n._(FILTER_LABELS.updated), value: 'updated' },
          ]}
          value={params.sort}
        />
      </FilterForm>
      <ResultCount total={result.totalDocs} />
      {result.docs.length ? (
        <ListingGrid testId="plugins-list">
          {result.docs.map((plugin) => (
            <PluginCard key={plugin.id} plugin={plugin} />
          ))}
        </ListingGrid>
      ) : (
        <EmptyState filtered={filtered} />
      )}
      <Pagination
        hrefFor={(page) => listingHref('plugins', params, page)}
        page={result.page ?? 1}
        totalPages={result.totalPages}
      />
      <ItemListJsonLd
        items={result.docs.map((plugin) => ({ name: plugin.name, url: `/plugins/${plugin.slug}` }))}
        name={i18n._(copy.title)}
        startIndex={result.pagingCounter}
      />
    </div>
  )
}
