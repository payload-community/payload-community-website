import { msg } from '@lingui/core/macro'
import type { Metadata } from 'next'

import { initLingui } from '@/lingui/server'
import { getServerSideURL } from '@/utilities/getURL'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'

// eslint-disable-next-line lingui/no-unlocalized-strings -- brand name, not translated
export const SITE_NAME = 'Payload CMS Community Portal'

export const SITE_DESCRIPTION = msg`News, plugins, resources and builds for Payload CMS, collected by the community.`

export const pageTitle = (title: string): string => `${title} | ${SITE_NAME}`

export const absoluteUrl = (path: string): string =>
  path.startsWith('http') ? path : `${getServerSideURL()}${path}`

export const pageMetadata = ({
  absoluteTitle,
  description,
  image,
  noIndex,
  path,
  title,
}: {
  /** Use `title` as is, without the " | site name" suffix. */
  absoluteTitle?: boolean
  description: string
  image?: string | null
  noIndex?: boolean
  path: string
  title: string
}): Metadata => {
  const fullTitle = absoluteTitle ? title : pageTitle(title)
  const text = description || initLingui()._(SITE_DESCRIPTION)
  return {
    alternates: { canonical: path },
    description: text,
    openGraph: mergeOpenGraph({
      description: text,
      ...(image ? { images: [{ url: absoluteUrl(image) }] } : {}),
      title: fullTitle,
      url: path,
    }),
    ...(noIndex ? { robots: { follow: true, index: false } } : {}),
    title: fullTitle,
  }
}
