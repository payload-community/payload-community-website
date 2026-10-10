import type { Metadata } from 'next'

import { getServerSideURL } from '@/utilities/getURL'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'

// eslint-disable-next-line lingui/no-unlocalized-strings -- brand name, not translated
export const SITE_NAME = 'Payload CMS Community Portal'

export const pageTitle = (title: string): string => `${title} | ${SITE_NAME}`

export const absoluteUrl = (path: string): string =>
  path.startsWith('http') ? path : `${getServerSideURL()}${path}`

export const pageMetadata = ({
  description,
  image,
  noIndex,
  path,
  title,
}: {
  description: string
  image?: string | null
  noIndex?: boolean
  path: string
  title: string
}): Metadata => {
  const fullTitle = pageTitle(title)
  return {
    alternates: { canonical: path },
    description,
    openGraph: mergeOpenGraph({
      description,
      ...(image ? { images: [{ url: absoluteUrl(image) }] } : {}),
      title: fullTitle,
      url: path,
    }),
    ...(noIndex ? { robots: { follow: true, index: false } } : {}),
    title: fullTitle,
  }
}
