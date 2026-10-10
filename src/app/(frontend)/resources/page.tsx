import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { SearchParams } from 'nuqs/server'
import React from 'react'

import { initLingui } from '@/lingui/server'
import { ResourceCard } from '@/website/cards'
import { RESOURCE_TYPE_LABELS } from '@/website/labels'
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
import {
  hasActiveFilters,
  listingHref,
  listingLoaders,
  RESOURCE_TYPE_VALUES,
} from '@/website/listing/params'
import { resourcesQuery } from '@/website/listing/where'

type Args = { searchParams: Promise<SearchParams> }

export async function generateMetadata({ searchParams }: Args): Promise<Metadata> {
  return listingMetadata('resources', await listingLoaders.resources(searchParams))
}

export default async function ResourcesPage({ searchParams }: Args) {
  const i18n = initLingui()
  const params = await listingLoaders.resources(searchParams)
  const copy = LISTING_COPY.resources
  const filtered = hasActiveFilters('resources', params)

  const [result, types, tags] = await Promise.all([
    findListing('resources', resourcesQuery(params), params.page),
    findFilterValues('resources', 'type'),
    findFilterValues('resources', 'tags'),
  ])
  if (!result.docs.length && result.totalDocs > 0) notFound()

  return (
    <div className="container py-16">
      <ListingHeader
        action={{ href: '/submit/resources', label: i18n._(copy.submit) }}
        description={i18n._(copy.description)}
        title={i18n._(copy.title)}
      />
      <FilterForm
        action="/resources"
        hasActiveFilters={filtered}
        q={params.q}
        searchLabel={i18n._(copy.search)}
      >
        <SelectField
          emptyLabel={i18n._(FILTER_LABELS.allTypes)}
          label={i18n._(FILTER_LABELS.type)}
          name="type"
          options={RESOURCE_TYPE_VALUES.filter((type) => types.includes(type)).map((type) => ({
            label: i18n._(RESOURCE_TYPE_LABELS[type]),
            value: type,
          }))}
          value={params.type}
        />
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
        <ListingGrid testId="resources-list">
          {result.docs.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </ListingGrid>
      ) : (
        <EmptyState filtered={filtered} />
      )}
      <Pagination
        hrefFor={(page) => listingHref('resources', params, page)}
        page={result.page ?? 1}
        totalPages={result.totalPages}
      />
      <ItemListJsonLd
        items={result.docs.map((resource) => ({
          name: resource.title,
          url: `/resources/${resource.slug}`,
        }))}
        name={i18n._(copy.title)}
        startIndex={result.pagingCounter}
      />
    </div>
  )
}
