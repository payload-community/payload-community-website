import { Trans } from '@lingui/react/macro'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

import { Badge } from '@/components/ui/badge'
import { initLingui } from '@/lingui/server'
import { TagList } from '@/website/cards'
import { BackLink, ExternalButton, FactList, SubmittedBy } from '@/website/detail-components'
import { entrySlugs, findEntryBySlug } from '@/website/detail'
import { FACT_LABELS } from '@/website/detail-labels'
import { formatDate, hostOf } from '@/website/format'
import { JsonLd } from '@/website/JsonLd'
import { RESOURCE_TYPE_LABELS } from '@/website/labels'
import { absoluteUrl, pageMetadata } from '@/website/metadata'

export const revalidate = 300

type Args = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return entrySlugs('resources')
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params
  const resource = await findEntryBySlug('resources', slug)
  if (!resource) return {}
  return pageMetadata({
    description: resource.description,
    path: `/resources/${resource.slug}`,
    title: resource.title,
  })
}

export default async function ResourcePage({ params }: Args) {
  const i18n = initLingui()
  const { slug } = await params
  const resource = await findEntryBySlug('resources', slug)
  if (!resource) notFound()

  const host = hostOf(resource.url)
  const path = `/resources/${resource.slug}`

  return (
    <article className="container max-w-3xl py-16" data-testid="resource-detail">
      <BackLink href="/resources">
        <Trans comment="Back link on a resource page">All resources</Trans>
      </BackLink>
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline">{i18n._(RESOURCE_TYPE_LABELS[resource.type])}</Badge>
          <span>{host}</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{resource.title}</h1>
        <SubmittedBy author={resource.populatedAuthor} />
      </header>
      <div className="my-8">
        <ExternalButton href={resource.url} testId="visit-resource">
          <Trans comment="Main button on a resource page, e.g. 'Visit payloadcms.com'">
            Visit {host}
          </Trans>
        </ExternalButton>
      </div>
      <p className="whitespace-pre-line text-lg leading-relaxed">{resource.description}</p>
      <div className="mt-6">
        <TagList tags={resource.tags} />
      </div>
      <div className="mt-10 border-t border-border pt-6">
        <FactList
          facts={[
            {
              label: i18n._(FACT_LABELS.added),
              value: formatDate(i18n.locale, resource.createdAt),
            },
            {
              label: i18n._(FACT_LABELS.updated),
              value: formatDate(i18n.locale, resource.updatedAt),
            },
          ]}
        />
      </div>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'CreativeWork',
          dateCreated: resource.createdAt,
          dateModified: resource.updatedAt,
          description: resource.description,
          keywords: resource.tags?.join(', ') || undefined,
          mainEntityOfPage: absoluteUrl(path),
          name: resource.title,
          url: resource.url,
        }}
      />
    </article>
  )
}
