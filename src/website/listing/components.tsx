import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getServerSideURL } from '@/utilities/getURL'
import { cn } from '@/utilities/ui'

import { JsonLd } from '../JsonLd'
import { paginationItems } from './params'

export const ListingHeader: React.FC<{
  action?: { href: string; label: string }
  description: string
  title: string
}> = ({ action, description, title }) => (
  <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div className="max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
      <p className="mt-2 text-muted-foreground">{description}</p>
    </div>
    {action && (
      <Button asChild variant="outline">
        <Link href={action.href}>
          <Plus aria-hidden />
          {action.label}
        </Link>
      </Button>
    )}
  </header>
)

const selectClassName =
  'h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export type SelectOption = { label: string; value: string }

export const SelectField: React.FC<{
  emptyLabel?: string
  label: string
  name: string
  options: SelectOption[]
  value: string | null
}> = ({ emptyLabel, label, name, options, value }) => {
  const id = `filter-${name}`
  return (
    <div className="flex min-w-40 flex-1 flex-col gap-1.5 sm:flex-none">
      <Label htmlFor={id}>{label}</Label>
      <select className={selectClassName} defaultValue={value ?? ''} id={id} name={name}>
        {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/** A plain GET form so filtering works without JavaScript; submitting resets the page. */
export const FilterForm: React.FC<{
  action: string
  children?: React.ReactNode
  hasActiveFilters: boolean
  q: string
  searchLabel: string
}> = ({ action, children, hasActiveFilters, q, searchLabel }) => {
  const { t } = useLingui()
  return (
    <form
      action={action}
      aria-label={t({
        comment: 'Accessible name of the filter form on listing pages',
        message: 'Filters',
      })}
      className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4"
      method="get"
      role="search"
    >
      <div className="flex min-w-56 flex-[2] flex-col gap-1.5">
        <Label htmlFor="filter-q">{searchLabel}</Label>
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            className="pl-9"
            defaultValue={q}
            id="filter-q"
            maxLength={100}
            name="q"
            type="search"
          />
        </div>
      </div>
      {children}
      <div className="flex gap-2">
        <Button type="submit">
          <Trans comment="Submit button of the filter form on listing pages">Apply</Trans>
        </Button>
        {hasActiveFilters && (
          <Button asChild variant="ghost">
            <Link href={action}>
              <Trans comment="Link that removes all search filters on a listing page">Clear</Trans>
            </Link>
          </Button>
        )}
      </div>
    </form>
  )
}

export const ResultCount: React.FC<{ total: number }> = ({ total }) => (
  <p aria-live="polite" className="mb-4 text-sm text-muted-foreground" data-testid="result-count">
    <Plural one="# result" other="# results" value={total} />
  </p>
)

export const ListingGrid: React.FC<{ children: React.ReactNode; testId: string }> = ({
  children,
  testId,
}) => (
  <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" data-testid={testId}>
    {React.Children.map(children, (child) => (
      <li>{child}</li>
    ))}
  </ul>
)

export const EmptyState: React.FC<{ filtered: boolean }> = ({ filtered }) => (
  <div
    className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground"
    data-testid="empty-state"
  >
    {filtered ? (
      <Trans>Nothing matches these filters. Try a different search or clear the filters.</Trans>
    ) : (
      <Trans>Nothing here yet.</Trans>
    )}
  </div>
)

export const Pagination: React.FC<{
  hrefFor: (page: number) => string
  page: number
  totalPages: number
}> = ({ hrefFor, page, totalPages }) => {
  const { t } = useLingui()
  if (totalPages <= 1) return null
  const linkClassName =
    'inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-md px-3 text-sm hover:bg-accent'

  return (
    <nav
      aria-label={t({
        comment: 'Accessible name of the page navigation below a listing',
        message: 'Pagination',
      })}
      className="mt-10 flex flex-wrap items-center justify-center gap-1"
    >
      {page > 1 && (
        <Link className={linkClassName} href={hrefFor(page - 1)} rel="prev">
          <ChevronLeft aria-hidden className="size-4" />
          <Trans comment="Pagination link to the previous page">Previous</Trans>
        </Link>
      )}
      {paginationItems(page, totalPages).map((item, i) =>
        item === null ? (
          <span aria-hidden className="px-2 text-muted-foreground" key={`gap-${i}`}>
            …
          </span>
        ) : (
          <Link
            aria-current={item === page ? 'page' : undefined}
            aria-label={t({
              comment: 'Accessible name of a pagination link',
              message: `Page ${item}`,
            })}
            className={cn(linkClassName, item === page && 'border border-border font-semibold')}
            href={hrefFor(item)}
            key={item}
          >
            {item}
          </Link>
        ),
      )}
      {page < totalPages && (
        <Link className={linkClassName} href={hrefFor(page + 1)} rel="next">
          <Trans comment="Pagination link to the next page">Next</Trans>
          <ChevronRight aria-hidden className="size-4" />
        </Link>
      )}
    </nav>
  )
}

export const ItemListJsonLd: React.FC<{
  items: { name: string; url: string }[]
  name: string
  startIndex: number
}> = ({ items, name, startIndex }) => {
  const base = getServerSideURL()
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: items.map((item, i) => ({
          '@type': 'ListItem',
          name: item.name,
          position: startIndex + i,
          url: item.url.startsWith('http') ? item.url : `${base}${item.url}`,
        })),
        name,
      }}
    />
  )
}
