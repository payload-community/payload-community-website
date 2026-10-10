import { Trans, useLingui } from '@lingui/react/macro'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

import { CopyButton } from '@/blocks/Code/CopyButton'
import { Button } from '@/components/ui/button'

export const BackLink: React.FC<{ children: React.ReactNode; href: string }> = ({
  children,
  href,
}) => (
  <Link
    className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    href={href}
  >
    <ArrowLeft aria-hidden className="size-4" />
    {children}
  </Link>
)

export const ExternalButton: React.FC<{
  children: React.ReactNode
  href: string
  testId?: string
  variant?: 'default' | 'outline'
}> = ({ children, href, testId, variant = 'default' }) => (
  <Button asChild size={variant === 'default' ? 'lg' : 'default'} variant={variant}>
    <a data-testid={testId} href={href} rel="noopener noreferrer" target="_blank">
      {children}
      <ExternalLink aria-hidden />
    </a>
  </Button>
)

export type PublicAuthor = { avatarUrl?: string | null; name?: string | null } | null | undefined

export const Avatar: React.FC<{ size?: number; url?: string | null }> = ({ size = 32, url }) =>
  url ? (
    <Image
      alt=""
      className="rounded-full border border-border"
      height={size}
      src={url}
      unoptimized
      width={size}
    />
  ) : null

export const SubmittedBy: React.FC<{ author: PublicAuthor }> = ({ author }) => {
  const name = author?.name
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="submitted-by">
      <Avatar size={24} url={author?.avatarUrl} />
      {name ? (
        <Trans comment="Detail page: the member who submitted the entry">Submitted by {name}</Trans>
      ) : (
        <Trans comment="Detail page: shown when the submitter deleted their account">
          Submitted by a former member
        </Trans>
      )}
    </p>
  )
}

export type Fact = { label: string; value: React.ReactNode }

export const FactList: React.FC<{ facts: Fact[] }> = ({ facts }) => {
  const visible = facts.filter(
    (fact) => fact.value !== null && fact.value !== undefined && fact.value !== '',
  )
  if (!visible.length) return null
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[auto_1fr]">
      {visible.map((fact) => (
        <React.Fragment key={fact.label}>
          <dt className="text-muted-foreground">{fact.label}</dt>
          <dd className="font-medium">{fact.value}</dd>
        </React.Fragment>
      ))}
    </dl>
  )
}

export const InstallBox: React.FC<{ packageName: string }> = ({ packageName }) => {
  const { t } = useLingui()
  // eslint-disable-next-line lingui/no-unlocalized-strings -- shell command
  const command = `pnpm add ${packageName}`
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/50 py-2 pl-4 pr-2"
      data-testid="install-box"
    >
      <code className="overflow-x-auto font-mono text-sm">{command}</code>
      <CopyButton
        code={command}
        label={t({
          comment: 'Accessible name of the copy button next to the install command',
          message: `Copy the install command for ${packageName}`,
        })}
      />
    </div>
  )
}

export const DetailSection: React.FC<{ children: React.ReactNode; title: string }> = ({
  children,
  title,
}) => (
  <section className="flex flex-col gap-3">
    <h2 className="text-lg font-semibold">{title}</h2>
    {children}
  </section>
)
