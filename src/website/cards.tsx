import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { Download, ExternalLink, GitFork, Star } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

import { Media } from '@/components/Media'
import { Badge } from '@/components/ui/badge'
import type { Build, Plugin, Post, Resource } from '@/payload-types'
import { cn } from '@/utilities/ui'

import { formatCompactNumber, formatDate, hostOf } from './format'
import { useResourceTypeLabel } from './labels'

const CardShell: React.FC<{
  children: React.ReactNode
  className?: string
  testId: string
}> = ({ children, className, testId }) => (
  <article
    className={cn(
      'relative flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-sm transition-colors hover:border-foreground/30 focus-within:ring-2 focus-within:ring-ring',
      className,
    )}
    data-testid={testId}
  >
    {children}
  </article>
)

/** The title link covers the whole card; other links inside need `relative z-10`. */
const CardTitle: React.FC<{ children: React.ReactNode; external?: boolean; href: string }> = ({
  children,
  external,
  href,
}) => (
  <h3 className="text-lg font-semibold leading-snug">
    {external ? (
      <a
        className="after:absolute after:inset-0 hover:underline focus:outline-none"
        href={href}
        rel="noopener noreferrer"
        target="_blank"
      >
        {children}
        <ExternalLink aria-hidden className="ml-1 inline size-4 align-baseline opacity-60" />
      </a>
    ) : (
      <Link className="after:absolute after:inset-0 hover:underline focus:outline-none" href={href}>
        {children}
      </Link>
    )}
  </h3>
)

export const TagList: React.FC<{ tags?: string[] | null }> = ({ tags }) => {
  const { t } = useLingui()
  if (!tags?.length) return null
  return (
    <ul
      aria-label={t({ comment: 'Accessible name of the list of tags on a card', message: 'Tags' })}
      className="flex flex-wrap gap-1.5"
    >
      {tags.map((tag) => (
        <li key={tag}>
          <Badge className="font-normal" variant="secondary">
            {tag}
          </Badge>
        </li>
      ))}
    </ul>
  )
}

const Meta: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
    {children}
  </div>
)

export const postHref = (post: Pick<Post, 'origin' | 'slug' | 'url'>) =>
  post.origin === 'imported' && post.url ? post.url : `/news/${post.slug}`

export const PostCard: React.FC<{ post: Post }> = ({ post }) => {
  const { i18n } = useLingui()
  const imported = post.origin === 'imported'
  const sourceName = typeof post.source === 'object' ? post.source?.name : null
  const authorName = post.populatedAuthor?.name
  const date = formatDate(i18n.locale, post.date ?? post.createdAt)
  const image = typeof post.image === 'object' ? post.image : null

  return (
    <CardShell className="p-0" testId="post-card">
      {image && (
        <Media
          className="aspect-[1200/630] overflow-hidden rounded-t-lg"
          imgClassName="h-full w-full object-cover"
          resource={image as never}
          size="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
        />
      )}
      <div className="flex flex-1 flex-col gap-3 p-5 pt-0 first:pt-5">
        <CardTitle external={imported} href={postHref(post)}>
          {post.title}
        </CardTitle>
        {post.summary && <p className="line-clamp-3 text-sm">{post.summary}</p>}
        <TagList tags={post.tags} />
        <Meta>
          {date && <time dateTime={post.date ?? post.createdAt}>{date}</time>}
          {imported ? (
            sourceName && (
              <span>
                <Trans comment="Card footer of an imported news post: the site it comes from">
                  on {sourceName}
                </Trans>
              </span>
            )
          ) : (
            <span>
              {authorName ? (
                <Trans comment="Card footer of a community post: who wrote it">
                  by {authorName}
                </Trans>
              ) : (
                <Trans comment="Shown instead of the author's name when the account was deleted">
                  by a former member
                </Trans>
              )}
            </span>
          )}
        </Meta>
      </div>
    </CardShell>
  )
}

export const ResourceCard: React.FC<{ resource: Resource }> = ({ resource }) => {
  const { i18n } = useLingui()
  const typeLabel = useResourceTypeLabel(resource.type)
  const updated = formatDate(i18n.locale, resource.updatedAt)

  return (
    <CardShell testId="resource-card">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="outline">{typeLabel}</Badge>
        <span>{hostOf(resource.url)}</span>
      </div>
      <CardTitle href={`/resources/${resource.slug}`}>{resource.title}</CardTitle>
      <p className="line-clamp-3 text-sm">{resource.description}</p>
      <TagList tags={resource.tags} />
      <Meta>
        {updated && (
          <span>
            <Trans comment="Card footer: when the entry was last updated">
              Updated <time dateTime={resource.updatedAt}>{updated}</time>
            </Trans>
          </span>
        )}
      </Meta>
    </CardShell>
  )
}

export const PluginStats: React.FC<{ plugin: Plugin; showForks?: boolean }> = ({
  plugin,
  showForks,
}) => {
  const { i18n } = useLingui()
  const stars = plugin.stars ?? 0
  const forks = plugin.forks ?? 0
  const downloads = plugin.npmWeeklyDownloads
  const weeklyDownloads = downloads != null ? formatCompactNumber(i18n.locale, downloads) : null

  return (
    <>
      {plugin.stars != null && (
        <span className="inline-flex items-center gap-1">
          <Star aria-hidden className="size-4" />
          <span aria-hidden>{formatCompactNumber(i18n.locale, stars)}</span>
          <span className="sr-only">
            <Plural one="# GitHub star" other="# GitHub stars" value={stars} />
          </span>
        </span>
      )}
      {showForks && plugin.forks != null && (
        <span className="inline-flex items-center gap-1">
          <GitFork aria-hidden className="size-4" />
          <span aria-hidden>{formatCompactNumber(i18n.locale, forks)}</span>
          <span className="sr-only">
            <Plural one="# fork" other="# forks" value={forks} />
          </span>
        </span>
      )}
      {downloads != null && (
        <span className="inline-flex items-center gap-1">
          <Download aria-hidden className="size-4" />
          <span aria-hidden>
            <Trans comment="Compact weekly npm downloads, e.g. '1.2K/week'">
              {weeklyDownloads}/week
            </Trans>
          </span>
          <span className="sr-only">
            <Plural
              one="# npm download per week"
              other="# npm downloads per week"
              value={downloads}
            />
          </span>
        </span>
      )}
      {plugin.npmLatestVersion && <span>v{plugin.npmLatestVersion}</span>}
    </>
  )
}

export const PluginCard: React.FC<{ plugin: Plugin }> = ({ plugin }) => {
  const { i18n } = useLingui()
  const created = formatDate(i18n.locale, plugin.githubCreatedAt ?? plugin.createdAt)
  const updated = formatDate(i18n.locale, plugin.lastPushedAt ?? plugin.updatedAt)

  return (
    <CardShell testId="plugin-card">
      <CardTitle href={`/plugins/${plugin.slug}`}>{plugin.name}</CardTitle>
      {plugin.fullName && <p className="-mt-2 text-sm text-muted-foreground">{plugin.fullName}</p>}
      <p className="line-clamp-3 text-sm">{plugin.description}</p>
      <TagList tags={plugin.topics} />
      <Meta>
        <PluginStats plugin={plugin} />
      </Meta>
      <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
        {created && (
          <span>
            <Trans comment="Plugin card: when the plugin was created">Created {created}</Trans>
          </span>
        )}
        {updated && (
          <span>
            <Trans comment="Plugin card: when the plugin's code was last updated">
              Updated {updated}
            </Trans>
          </span>
        )}
      </div>
    </CardShell>
  )
}

export const BuildCard: React.FC<{ build: Build }> = ({ build }) => {
  const { i18n } = useLingui()
  const updated = formatDate(i18n.locale, build.updatedAt)
  const version = build.basePayloadVersion

  return (
    <CardShell testId="build-card">
      <CardTitle href={`/builds/${build.slug}`}>{build.name}</CardTitle>
      <p className="text-sm text-muted-foreground">
        <Trans comment="Build card: the Payload release the build is based on, e.g. 'Based on Payload 3.90.2'">
          Based on Payload {version}
        </Trans>
      </p>
      <p className="line-clamp-3 text-sm">{build.description}</p>
      <TagList tags={build.tags} />
      <Meta>
        {updated && (
          <span>
            <Trans comment="Card footer: when the entry was last updated">
              Updated <time dateTime={build.updatedAt}>{updated}</time>
            </Trans>
          </span>
        )}
      </Meta>
    </CardShell>
  )
}
