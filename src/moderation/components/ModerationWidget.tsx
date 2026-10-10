import type { ServerProps } from 'payload'
import Link from 'next/link'
import React from 'react'

import { isModerator } from '@/access'

import { MODERATED_COLLECTIONS } from '../config'
import { COLLECTION_LABELS } from '../notifications'
import { countByStatus } from '../queue'

import './index.scss'

/** `beforeDashboard`: pending entries per type with a link to the queue (moderators/admins). */
export async function ModerationWidget({ i18n, payload, user }: ServerProps) {
  if (!user || !isModerator(user)) return null
  const counts = await countByStatus(payload, user, 'pending')
  const t = i18n.t as (key: string) => string

  return (
    <section className="plc-moderation-widget">
      <h2>{t('plc:moderationWaiting')}</h2>
      <ul>
        {MODERATED_COLLECTIONS.map((collection) => (
          <li key={collection}>
            <strong>{counts[collection]}</strong> {COLLECTION_LABELS[collection]}
          </li>
        ))}
      </ul>
      <Link href={`${payload.config.routes.admin}/moderation`}>{t('plc:moderationOpenQueue')}</Link>
    </section>
  )
}
