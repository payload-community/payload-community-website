import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import React from 'react'

import { isModerator } from '@/access'

import { COLLECTION_LABELS } from '../notifications'
import { countByStatus, loadQueue, QUEUE_PAGE_SIZE, QUEUE_TABS, type QueueTab } from '../queue'
import { ActionButtons } from './ActionButtons'

import './index.scss'

type T = (key: string, vars?: Record<string, unknown>) => string

const TAB_LABELS: Record<QueueTab, string> = {
  pending: 'plc:moderationTabPending',
  rejected: 'plc:moderationTabRejected',
  unpublished: 'plc:moderationTabUnpublished',
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

const formatDate = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : '–'

/** `/admin/moderation`: merged queue of the four moderated collections (spec §8). */
export async function ModerationView({ initPageResult, params, searchParams }: AdminViewServerProps) {
  const { locale, permissions, req, visibleEntities } = initPageResult
  const { i18n, payload, user } = req
  const adminRoute = payload.config.routes.admin

  if (!user) redirect(`${adminRoute}/login?redirect=${encodeURIComponent(`${adminRoute}/moderation`)}`)
  if (!isModerator(user)) notFound()

  const t = i18n.t as T
  const requestedTab = first(searchParams?.tab as string | string[] | undefined)
  const tab = QUEUE_TABS.find((value) => value === requestedTab) ?? 'pending'
  const page = Math.max(1, Number.parseInt(first(searchParams?.page as string | undefined) ?? '1', 10) || 1)

  const [{ rows, total }, ...tabCounts] = await Promise.all([
    loadQueue(payload, user, tab, page),
    ...QUEUE_TABS.map((status) => countByStatus(payload, user, status)),
  ])
  const counts = Object.fromEntries(
    QUEUE_TABS.map((status, index) => [status, Object.values(tabCounts[index]).reduce((a, b) => a + b, 0)]),
  ) as Record<QueueTab, number>
  const pages = Math.max(1, Math.ceil(total / QUEUE_PAGE_SIZE))
  const href = (query: { page?: number; tab: QueueTab }) =>
    `${adminRoute}/moderation?tab=${query.tab}${query.page && query.page > 1 ? `&page=${query.page}` : ''}`

  return (
    <DefaultTemplate
      i18n={i18n}
      locale={locale}
      params={params}
      payload={payload}
      permissions={permissions}
      req={req}
      searchParams={searchParams}
      user={user}
      visibleEntities={visibleEntities}
    >
      <Gutter className="plc-moderation">
        <h1>{t('plc:moderationQueue')}</h1>
        <nav className="plc-moderation__tabs">
          {QUEUE_TABS.map((value) => (
            <Link
              aria-current={value === tab ? 'page' : undefined}
              className={`plc-moderation__tab${value === tab ? ' plc-moderation__tab--active' : ''}`}
              href={href({ tab: value })}
              key={value}
            >
              {t(TAB_LABELS[value])} ({counts[value]})
            </Link>
          ))}
        </nav>

        {rows.length === 0 ? (
          <p className="plc-moderation__empty">{t('plc:moderationEmpty')}</p>
        ) : (
          <div className="table">
            <table cellPadding="0" cellSpacing="0">
              <thead>
                <tr>
                  <th>{t('plc:moderationColumnType')}</th>
                  <th>{t('plc:moderationColumnTitle')}</th>
                  <th>{t('plc:moderationColumnAuthor')}</th>
                  <th>{t('plc:moderationColumnSubmitted')}</th>
                  {tab !== 'pending' && <th>{t('plc:moderationColumnModerated')}</th>}
                  <th>{t('plc:moderationColumnLinks')}</th>
                  <th>{t('plc:moderationColumnActions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const editURL = `${adminRoute}/collections/${row.collection}/${row.id}`
                  return (
                    <tr data-collection={row.collection} data-id={row.id} key={`${row.collection}-${row.id}`}>
                      <td>{COLLECTION_LABELS[row.collection]}</td>
                      <td>
                        <Link href={editURL}>{row.title}</Link>
                        {row.rejectionReason && (
                          <div className="plc-moderation__reason">{row.rejectionReason}</div>
                        )}
                      </td>
                      <td>{row.author ?? t('plc:moderationUnknownAuthor')}</td>
                      <td>{formatDate(row.submittedAt)}</td>
                      {tab !== 'pending' && <td>{formatDate(row.moderatedAt)}</td>}
                      <td className="plc-moderation__links">
                        <Link href={editURL}>{t('plc:moderationEdit')}</Link>
                        <Link href={`${editURL}/versions`}>{t('plc:moderationVersions')}</Link>
                      </td>
                      <td>
                        <ActionButtons collection={row.collection} id={row.id} status={row.status} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <nav className="plc-moderation__pages">
            {page > 1 && <Link href={href({ page: page - 1, tab })}>{t('general:previous')}</Link>}
            <span>
              {page} / {pages}
            </span>
            {page < pages && <Link href={href({ page: page + 1, tab })}>{t('general:next')}</Link>}
          </nav>
        )}
      </Gutter>
    </DefaultTemplate>
  )
}
