import { Trans } from '@lingui/react/macro'
import type { Metadata } from 'next'
import { draftMode } from 'next/headers'
import { notFound } from 'next/navigation'
import React from 'react'

import { Media } from '@/components/Media'
import RichText from '@/components/RichText'
import { initLingui } from '@/lingui/server'
import type { PostMedia } from '@/payload-types'
import { TagList } from '@/website/cards'
import { Avatar, BackLink } from '@/website/detail-components'
import { entrySlugs, findEntryBySlug } from '@/website/detail'
import { formatDate } from '@/website/format'
import { JsonLd } from '@/website/JsonLd'
import { absoluteUrl, pageMetadata, SITE_NAME } from '@/website/metadata'

export const revalidate = 300

type Args = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return entrySlugs('posts')
}

const mediaUrl = (media: PostMedia | string | null | undefined): string | null =>
  media && typeof media === 'object' ? (media.sizes?.og?.url ?? media.url ?? null) : null

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params
  const post = await findEntryBySlug('posts', slug)
  if (!post) return {}
  return pageMetadata({
    description: post.meta?.description || post.summary || '',
    image: mediaUrl(post.meta?.image) ?? mediaUrl(post.image),
    path: `/news/${post.slug}`,
    title: post.meta?.title || post.title,
  })
}

export default async function NewsPostPage({ params }: Args) {
  const i18n = initLingui()
  const { slug } = await params
  const post = await findEntryBySlug('posts', slug)
  if (!post) notFound()
  const { isEnabled: draft } = await draftMode()

  const path = `/news/${post.slug}`
  const published = post.date ?? post.createdAt
  const date = formatDate(i18n.locale, published)
  const author = post.populatedAuthor
  const authorName = author?.name
  const image = typeof post.image === 'object' ? post.image : null

  return (
    <article className="pb-24 pt-16" data-testid="post-detail">
      <div className="container max-w-3xl">
        <BackLink href="/news">
          <Trans comment="Back link on a news post">All news</Trans>
        </BackLink>
        {draft && post._status !== 'published' && (
          <p className="mb-4 rounded-md border border-warning bg-warning/20 px-3 py-2 text-sm">
            <Trans comment="Banner on a previewed draft post">
              Draft preview: this version is not published.
            </Trans>
          </p>
        )}
        <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">{post.title}</h1>
        {post.summary && <p className="mt-4 text-xl text-muted-foreground">{post.summary}</p>}
        <div className="mt-6 flex items-center gap-3 text-sm text-muted-foreground">
          <Avatar size={32} url={author?.avatarUrl} />
          <span>
            {authorName ? (
              <Trans comment="News post byline">by {authorName}</Trans>
            ) : (
              <Trans comment="Shown instead of the author's name when the account was deleted">
                by a former member
              </Trans>
            )}
          </span>
          {date && <time dateTime={published}>{date}</time>}
        </div>
        <div className="mt-4">
          <TagList tags={post.tags} />
        </div>
      </div>
      {image && (
        <div className="container mt-10 max-w-4xl">
          <Media
            className="overflow-hidden rounded-lg"
            imgClassName="w-full"
            priority
            resource={image as never}
          />
        </div>
      )}
      {post.content && (
        <div className="container mt-10 max-w-3xl">
          <RichText data={post.content} enableGutter={false} />
        </div>
      )}
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          author: { '@type': 'Person', name: authorName ?? undefined },
          dateModified: post.updatedAt,
          datePublished: published,
          description: post.summary ?? undefined,
          headline: post.title,
          image: mediaUrl(post.image) ? absoluteUrl(mediaUrl(post.image)!) : undefined,
          keywords: post.tags?.join(', ') || undefined,
          mainEntityOfPage: absoluteUrl(path),
          publisher: { '@type': 'Organization', name: SITE_NAME },
        }}
      />
    </article>
  )
}
