import type { Metadata } from 'next'

import { pageMetadata, SITE_NAME } from '@/website/metadata'

import type { Media, Page } from '../payload-types'

const imageUrl = (image: Media | string | null | undefined): string | null =>
  image && typeof image === 'object' ? (image.sizes?.og?.url ?? image.url ?? null) : null

/** Metadata for CMS pages (SEO plugin fields); the home page is titled with the site name alone. */
export const generateMeta = (doc: Partial<Page> | null): Metadata => {
  const isHome = doc?.slug === 'home'
  return pageMetadata({
    absoluteTitle: isHome,
    description: doc?.meta?.description ?? '',
    image: imageUrl(doc?.meta?.image),
    path: !doc?.slug || isHome ? '/' : `/${doc.slug}`,
    title: isHome ? SITE_NAME : doc?.meta?.title || doc?.title || SITE_NAME,
  })
}
