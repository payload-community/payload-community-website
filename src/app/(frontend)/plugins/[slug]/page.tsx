import { Trans } from '@lingui/react/macro'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

import { Badge } from '@/components/ui/badge'
import { initLingui } from '@/lingui/server'
import { TagList } from '@/website/cards'
import {
  Avatar,
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
  return entrySlugs('plugins')
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug } = await params
  const plugin = await findEntryBySlug('plugins', slug)
  if (!plugin) return {}
  return pageMetadata({
    description: plugin.description,
    image: plugin.ownerAvatarUrl,
    path: `/plugins/${plugin.slug}`,
    title: plugin.name,
  })
}

const npmUrl = (packageName: string) => `https://www.npmjs.com/package/${packageName}`

export default async function PluginPage({ params }: Args) {
  const i18n = initLingui()
  const { slug } = await params
  const plugin = await findEntryBySlug('plugins', slug)
  if (!plugin) notFound()

  const path = `/plugins/${plugin.slug}`
  const number = (value: number | null | undefined) =>
    value == null ? null : new Intl.NumberFormat(i18n.locale).format(value)
  const homepage = plugin.homepage ? (
    <a className="underline" href={plugin.homepage} rel="noopener noreferrer" target="_blank">
      {hostOf(plugin.homepage)}
    </a>
  ) : null

  return (
    <article className="container max-w-3xl py-16" data-testid="plugin-detail">
      <BackLink href="/plugins">
        <Trans comment="Back link on a plugin page">All plugins</Trans>
      </BackLink>
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Avatar size={56} url={plugin.ownerAvatarUrl} />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{plugin.name}</h1>
            {plugin.fullName && <p className="text-muted-foreground">{plugin.fullName}</p>}
          </div>
        </div>
        {(plugin.archived || plugin.isFork) && (
          <div className="flex gap-2">
            {plugin.archived && (
              <Badge variant="destructive">
                <Trans comment="Badge: the GitHub repository is archived (read-only)">
                  Archived
                </Trans>
              </Badge>
            )}
            {plugin.isFork && (
              <Badge variant="outline">
                <Trans comment="Badge: the repository is a fork of another repository">Fork</Trans>
              </Badge>
            )}
          </div>
        )}
        {plugin.origin === 'manual' && <SubmittedBy author={plugin.populatedAuthor} />}
      </header>

      <div className="my-8 flex flex-wrap gap-3">
        {plugin.repositoryUrl && (
          <ExternalButton href={plugin.repositoryUrl} testId="view-repository">
            <Trans comment="Main button on plugin and build pages">View repository</Trans>
          </ExternalButton>
        )}
        {plugin.npmPackage && (
          <ExternalButton href={npmUrl(plugin.npmPackage)} variant="outline">
            <Trans comment="Button on a plugin page">View on npm</Trans>
          </ExternalButton>
        )}
      </div>

      <div className="flex flex-col gap-10">
        <p className="whitespace-pre-line text-lg leading-relaxed">{plugin.description}</p>
        <TagList tags={plugin.topics} />

        {plugin.npmPackage && (
          <DetailSection title={i18n._(FACT_LABELS.npmPackage)}>
            <InstallBox packageName={plugin.npmPackage} />
            <FactList
              facts={[
                { label: i18n._(FACT_LABELS.latestVersion), value: plugin.npmLatestVersion },
                {
                  label: i18n._(FACT_LABELS.weeklyDownloads),
                  value: number(plugin.npmWeeklyDownloads),
                },
                {
                  label: i18n._(FACT_LABELS.lastPublished),
                  value: formatDate(i18n.locale, plugin.npmLastPublishedAt),
                },
              ]}
            />
          </DetailSection>
        )}

        <DetailSection title={i18n._(FACT_LABELS.repository)}>
          <FactList
            facts={[
              { label: i18n._(FACT_LABELS.stars), value: number(plugin.stars) },
              { label: i18n._(FACT_LABELS.forks), value: number(plugin.forks) },
              { label: i18n._(FACT_LABELS.license), value: plugin.license },
              {
                label: i18n._(FACT_LABELS.githubCreated),
                value: formatDate(i18n.locale, plugin.githubCreatedAt),
              },
              {
                label: i18n._(FACT_LABELS.lastPushed),
                value: formatDate(i18n.locale, plugin.lastPushedAt),
              },
              { label: i18n._(FACT_LABELS.homepage), value: homepage },
              {
                label: i18n._(FACT_LABELS.added),
                value: formatDate(i18n.locale, plugin.createdAt),
              },
            ]}
          />
        </DetailSection>
      </div>

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareSourceCode',
          codeRepository: plugin.repositoryUrl ?? undefined,
          dateCreated: plugin.githubCreatedAt ?? plugin.createdAt,
          dateModified: plugin.lastPushedAt ?? plugin.updatedAt,
          description: plugin.description,
          keywords: plugin.topics?.join(', ') || undefined,
          license: plugin.license ?? undefined,
          mainEntityOfPage: absoluteUrl(path),
          name: plugin.name,
          url: plugin.homepage ?? plugin.repositoryUrl ?? absoluteUrl(path),
        }}
      />
    </article>
  )
}
