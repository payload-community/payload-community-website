import type { Metadata } from 'next'
import { getServerSideURL } from './getURL'

const defaultOpenGraph: Metadata['openGraph'] = {
  type: 'website',
  images: [
    {
      height: 630,
      url: `${getServerSideURL()}/og-image.png`,
      width: 1200,
    },
  ],
  siteName: 'Payload CMS Community Portal',
  title: 'Payload CMS Community Portal',
}

export const mergeOpenGraph = (og?: Metadata['openGraph']): Metadata['openGraph'] => {
  return {
    ...defaultOpenGraph,
    ...og,
    images: og?.images ? og.images : defaultOpenGraph.images,
  }
}
