import type { ServerProps } from 'payload'
import Link from 'next/link'
import React from 'react'

import { isModerator } from '@/access'

import { countByStatus } from '../queue'

import './index.scss'

/** `afterNavLinks`: link to the moderation queue with the pending count (moderators/admins). */
export async function ModerationNavLink({ i18n, payload, user }: ServerProps) {
  if (!user || !isModerator(user)) return null
  const counts = await countByStatus(payload, user, 'pending')
  const pending = Object.values(counts).reduce((a, b) => a + b, 0)
  const t = i18n.t as (key: string) => string

  return (
    <Link className="nav__link plc-moderation-nav" href={`${payload.config.routes.admin}/moderation`} id="nav-moderation">
      <span className="nav__link-label">{t('plc:moderation')}</span>
      {pending > 0 && <span className="plc-moderation-nav__count">{pending}</span>}
    </Link>
  )
}
