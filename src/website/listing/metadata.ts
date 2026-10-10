import type { Metadata } from 'next'

import { initLingui } from '@/lingui/server'

import { pageMetadata } from '../metadata'
import { LISTING_COPY } from './copy'
import {
  hasActiveFilters,
  LISTING_PATHS,
  normalizePage,
  type ListingParams,
  type ListingSection,
} from './params'

/** Filtered views are not indexed; page 2+ of the plain listing has its own canonical URL. */
export const listingMetadata = (section: ListingSection, params: ListingParams): Metadata => {
  const i18n = initLingui()
  const page = normalizePage(params.page)
  const path = LISTING_PATHS[section] + (page > 1 ? `?page=${page}` : '')
  return pageMetadata({
    description: i18n._(LISTING_COPY[section].description),
    noIndex: hasActiveFilters(section, params),
    path,
    title: i18n._(LISTING_COPY[section].title),
  })
}
