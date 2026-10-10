import { Trans } from '@lingui/react/macro'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

import { initLingui } from '@/lingui/server'
import { TagList } from '@/website/cards'
import {
  BackLink,
  DetailSection,
  ExternalButton,
  FactList,
  InstallBox,
  SubmittedBy,
} from '@/website/detail-components'
import { entrySlugs, findEntryBySlug } from '@/website/detail'
import { FACT_LABELS } from '@/website/detail-labels'
import { formatDate, hostOf } from '@/website/format'
import { JsonLd } from '@/website/JsonLd'
import { absoluteUrl, pageMetadata } from '@/website/metadata'

export const revalidate = 300

type Args = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return entrySlugs('builds')
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params
  const build = await findEntryBySlug('builds', slug)
  if (!build) return {}
  return pageMetadata({
    description: build.description,
    path: `/builds/${build.slug}`,
    title: build.name,
  })
}

export default async function BuildPage({ params }: Args) {
  const i18n = initLingui()
  const { slug } = await params
  const build = await findEntryBySlug('builds', slug)
  if (!build) notFound()

  const path = `/builds/${build.slug}`
  const version = build.basePayloadVersion
  const changes = build.includedChanges ?? []

  return (
    <article className="container max-w-3xl py-16" data-testid="build-detail">
      <BackLink href="/builds">
        <Trans comment="Back link on a build page">All builds</Trans>
      </BackLink>
      <header className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{build.name}</h1>
        <p className="text-muted-foreground">
          <Trans comment="Build page: the Payload release the build is based on, e.g. 'Based on Payload 3.90.2'">
            Based on Payload {version}
          </Trans>
        </p>
        <SubmittedBy author={build.populatedAuthor} />
      </header>

      <div className="my-8">
        <ExternalButton href={build.repositoryUrl} testId="view-repository">
          <Trans comment="Main button on plugin and build pages">View repository</Trans>
        </ExternalButton>
      </div>

      <div className="flex flex-col gap-10">
        <p className="whitespace-pre-line text-lg leading-relaxed">{build.description}</p>
        <TagList tags={build.tags} />

        {build.npmPackage && (
          <DetailSection title={i18n._(FACT_LABELS.npmPackage)}>
            <InstallBox packageName={build.npmPackage} />
          </DetailSection>
        )}

        {changes.length > 0 && (
          <DetailSection title={i18n._(FACT_LABELS.includedChanges)}>
            <ul className="flex flex-col gap-4" data-testid="included-changes">
              {changes.map((change) => (
                <li className="rounded-md border border-border p-4" key={change.id ?? change.url}>
                  <a
                    className="font-medium underline-offset-4 hover:underline"
                    href={change.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {change.title}
                  </a>
                  <p className="text-xs text-muted-foreground">{hostOf(change.url)}</p>
                  {change.notes && (
                    <p className="mt-2 whitespace-pre-line text-sm">{change.notes}</p>
                  )}
                </li>
              ))}
            </ul>
          </DetailSection>
        )}

        <FactList
          facts={[
            { label: i18n._(FACT_LABELS.basePayloadVersion), value: version },
            {
              label: i18n._(FACT_LABELS.homepage),
              value: build.homepage ? (
                <a
                  className="underline"
                  href={build.homepage}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {hostOf(build.homepage)}
                </a>
              ) : null,
            },
            { label: i18n._(FACT_LABELS.added), value: formatDate(i18n.locale, build.createdAt) },
            { label: i18n._(FACT_LABELS.updated), value: formatDate(i18n.locale, build.updatedAt) },
          ]}
        />
      </div>

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareSourceCode',
          codeRepository: build.repositoryUrl,
          dateCreated: build.createdAt,
          dateModified: build.updatedAt,
          description: build.description,
          keywords: build.tags?.join(', ') || undefined,
          mainEntityOfPage: absoluteUrl(path),
          name: build.name,
          url: build.homepage ?? absoluteUrl(path),
        }}
      />
    </article>
  )
}
