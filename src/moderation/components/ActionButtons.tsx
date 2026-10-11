'use client'

import { Button, toast, useConfig, useTranslation } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

import type { PlcTranslationKeys, PlcTranslations } from '@/i18n'

import type { ModeratedCollection, ModerationAction, ModerationStatus } from '../config'

import './index.scss'

const VISIBLE: Record<ModerationStatus, ModerationAction[]> = {
  pending: ['approve', 'reject'],
  published: ['unpublish'],
  rejected: ['republish'],
  unpublished: ['republish'],
}

const LABELS = {
  approve: 'plc:moderationApprove',
  reject: 'plc:moderationReject',
  republish: 'plc:moderationRepublish',
  unpublish: 'plc:moderationUnpublish',
} as const satisfies Record<ModerationAction, PlcTranslationKeys>

const DONE = {
  approve: 'plc:moderationApproved',
  reject: 'plc:moderationRejected',
  republish: 'plc:moderationRepublished',
  unpublish: 'plc:moderationUnpublishedDone',
} as const satisfies Record<ModerationAction, PlcTranslationKeys>

type Props = {
  collection: ModeratedCollection
  disabled?: boolean
  /** The published main document is live (a newer draft may be waiting). */
  hasPublishedDoc?: boolean
  id: number | string
  /** Called after a successful action; defaults to refreshing the server components. */
  onDone?: () => void
  /** Restricts the buttons, e.g. to `unpublish` for authors. */
  only?: ModerationAction[]
  status: ModerationStatus
}

/** Approve / reject (with reason) / re-publish / unpublish buttons calling the moderation endpoint. */
export function ActionButtons({ collection, disabled, hasPublishedDoc, id, onDone, only, status }: Props) {
  const {
    config: {
      routes: { api },
    },
  } = useConfig()
  const { t } = useTranslation<PlcTranslations, PlcTranslationKeys>()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  let actions = [...VISIBLE[status]]
  if (hasPublishedDoc && !actions.includes('unpublish') && status !== 'unpublished') actions.push('unpublish')
  if (only) actions = actions.filter((action) => only.includes(action))

  const run = async (action: ModerationAction) => {
    setBusy(true)
    try {
      const res = await fetch(`${api}/moderation/${collection}/${id}/${action}`, {
        body: JSON.stringify(action === 'reject' && reason.trim() ? { reason: reason.trim() } : {}),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { errors?: { message?: string }[] } | null
        toast.error(json?.errors?.[0]?.message || t('plc:moderationActionFailed'))
        return
      }
      toast.success(t(DONE[action]))
      setRejecting(false)
      setReason('')
      if (onDone) onDone()
      else router.refresh()
    } catch {
      toast.error(t('plc:moderationActionFailed'))
    } finally {
      setBusy(false)
    }
  }

  if (rejecting) {
    return (
      <div className="plc-moderation-actions plc-moderation-actions--reject">
        <label className="plc-moderation-actions__label">
          {t('plc:moderationReasonLabel')}
          <textarea
            className="plc-moderation-actions__reason"
            maxLength={2000}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            value={reason}
          />
        </label>
        <div className="plc-moderation-actions__buttons">
          <Button buttonStyle="primary" disabled={busy} margin={false} onClick={() => run('reject')} size="small">
            {t('plc:moderationConfirmReject')}
          </Button>
          <Button
            buttonStyle="secondary"
            disabled={busy}
            margin={false}
            onClick={() => setRejecting(false)}
            size="small"
          >
            {t('general:cancel')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="plc-moderation-actions__buttons">
      {actions.map((action) => (
        <Button
          buttonStyle={action === 'approve' || action === 'republish' ? 'primary' : 'secondary'}
          disabled={busy || disabled}
          key={action}
          margin={false}
          onClick={() => (action === 'reject' ? setRejecting(true) : run(action))}
          size="small"
        >
          {t(LABELS[action])}
        </Button>
      ))}
    </div>
  )
}
