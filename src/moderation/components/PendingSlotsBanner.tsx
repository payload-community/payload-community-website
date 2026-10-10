import type { ServerProps } from 'payload'
import React from 'react'

import { isModerator } from '@/access'

import { MAX_PENDING_SUBMISSIONS } from '../config'
import { countPendingSubmissions } from '../limit'

import './index.scss'

type T = (key: string, vars?: Record<string, unknown>) => string

const slots = async ({ payload, user }: ServerProps) => {
  if (!user || isModerator(user)) return null
  const pending = await countPendingSubmissions(payload, user.id)
  return { free: Math.max(0, MAX_PENDING_SUBMISSIONS - pending), pending }
}

/** List view: explains pre-moderation and the remaining review slots to regular users. */
export async function PendingSlotsBanner(props: ServerProps) {
  const state = await slots(props)
  if (!state) return null
  const t = props.i18n.t as T
  const limit = MAX_PENDING_SUBMISSIONS

  return (
    <div className={`plc-pending-slots${state.free === 0 ? ' plc-pending-slots--full' : ''}`} role="status">
      {state.free === 0
        ? t('plc:pendingLimitReached', { count: limit })
        : t('plc:pendingSlotsInfo', { count: state.free, limit, pending: state.pending })}
    </div>
  )
}

/** Edit view, next to the save button: short version of the banner. */
export async function PendingSlotsNotice(props: ServerProps) {
  const state = await slots(props)
  if (!state) return null
  const t = props.i18n.t as T
  const limit = MAX_PENDING_SUBMISSIONS

  return (
    <span className="plc-pending-slots-notice" title={t('plc:pendingLimitReached', { count: limit })}>
      {state.free === 0
        ? t('plc:pendingSlotsNoticeFull', { limit })
        : t('plc:pendingSlotsNotice', { count: state.free, limit })}
    </span>
  )
}
