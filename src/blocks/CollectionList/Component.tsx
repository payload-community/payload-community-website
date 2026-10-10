import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

import type { Build, CollectionListBlock as CollectionListProps, Plugin, Post } from '@/payload-types'
import { BuildCard, PluginCard, PostCard } from '@/website/cards'
import { COLLECTION_LIST_SORT_FIELDS, getPayloadClient, PUBLIC_READ } from '@/website/queries'

export const CollectionListBlock: React.FC<CollectionListProps> = async ({
  heading,
  limit,
  link,
  relationTo,
  sort,
}) => {
  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    ...PUBLIC_READ,
    collection: relationTo,
    depth: 1,
    limit: limit || 6,
    pagination: false,
    sort: COLLECTION_LIST_SORT_FIELDS[relationTo][sort] ?? '-createdAt',
  })

  if (!docs.length) return null

  return (
    <section className="container" data-testid={`collection-list-${relationTo}`}>
      <div className="mb-6 flex items-baseline justify-between gap-4">
        {heading && <h2 className="text-2xl font-semibold">{heading}</h2>}
        {link?.href && link.label && (
          <Link
            className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
            href={link.href}
          >
            {link.label}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        )}
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {docs.map((doc) => (
          <li key={doc.id}>
            {relationTo === 'posts' && <PostCard post={doc as Post} />}
            {relationTo === 'plugins' && <PluginCard plugin={doc as Plugin} />}
            {relationTo === 'builds' && <BuildCard build={doc as Build} />}
          </li>
        ))}
      </ul>
    </section>
  )
}
