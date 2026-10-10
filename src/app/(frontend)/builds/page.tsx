import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { SearchParams } from 'nuqs/server'
import React from 'react'

import { initLingui } from '@/lingui/server'
import { BuildCard } from '@/website/cards'
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
import { buildsQuery } from '@/website/listing/where'

type Args = { searchParams: Promise<SearchParams> }

export async function generateMetadata({ searchParams }: Args): Promise<Metadata> {
  return listingMetadata('builds', await listingLoaders.builds(searchParams))
}

export default async function BuildsPage({ searchParams }: Args) {
  const i18n = initLingui()
  const params = await listingLoaders.builds(searchParams)
  const copy = LISTING_COPY.builds
  const filtered = hasActiveFilters('builds', params)

  const [result, versions, tags] = await Promise.all([
    findListing('builds', buildsQuery(params), params.page),
    findFilterValues('builds', 'basePayloadVersion'),
    findFilterValues('builds', 'tags'),
  ])
  if (!result.docs.length && result.totalDocs > 0) notFound()

  return (
    <div className="container py-16">
      <ListingHeader
        action={{ href: '/submit/builds', label: i18n._(copy.submit) }}
        description={i18n._(copy.description)}
        title={i18n._(copy.title)}
      />
      <FilterForm
        action="/builds"
        hasActiveFilters={filtered}
        q={params.q}
        searchLabel={i18n._(copy.search)}
      >
        {versions.length > 0 && (
          <SelectField
            emptyLabel={i18n._(FILTER_LABELS.allVersions)}
            label={i18n._(FILTER_LABELS.version)}
            name="version"
            options={versions.map((version) => ({ label: version, value: version }))}
            value={params.version}
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
        <SelectField
          label={i18n._(FILTER_LABELS.sort)}
          name="sort"
          options={[
            { label: i18n._(FILTER_LABELS.updated), value: 'updated' },
            { label: i18n._(FILTER_LABELS.newest), value: 'newest' },
          ]}
          value={params.sort}
        />
      </FilterForm>
      <ResultCount total={result.totalDocs} />
      {result.docs.length ? (
        <ListingGrid testId="builds-list">
          {result.docs.map((build) => (
            <BuildCard build={build} key={build.id} />
          ))}
        </ListingGrid>
      ) : (
        <EmptyState filtered={filtered} />
      )}
      <Pagination
        hrefFor={(page) => listingHref('builds', params, page)}
        page={result.page ?? 1}
        totalPages={result.totalPages}
      />
      <ItemListJsonLd
        items={result.docs.map((build) => ({ name: build.name, url: `/builds/${build.slug}` }))}
        name={i18n._(copy.title)}
        startIndex={result.pagingCounter}
      />
    </div>
  )
}
