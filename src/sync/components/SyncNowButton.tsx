'use client'

import { Button, toast, useConfig, useTranslation } from '@payloadcms/ui'
import React, { useState } from 'react'

import type { PlcTranslationKeys, PlcTranslations } from '@/i18n'

import './index.scss'

type Props = { task: 'plugins' | 'posts' }

/** Queues a sync job through `POST /api/sync/:task`; the worker runs it within a minute. */
export function SyncNowButton({ task }: Props) {
  const {
    config: {
      routes: { api },
    },
  } = useConfig()
  const { t } = useTranslation<PlcTranslations, PlcTranslationKeys>()
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    try {
      const res = await fetch(`${api}/sync/${task}`, {
        body: '{}',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      const json = (await res.json().catch(() => null)) as {
        alreadyQueued?: boolean
        errors?: { message?: string }[]
      } | null
      if (!res.ok) {
        toast.error(json?.errors?.[0]?.message || t('plc:syncFailed'))
        return
      }
      toast.success(t(json?.alreadyQueued ? 'plc:syncAlreadyQueued' : 'plc:syncQueued'))
    } catch {
      toast.error(t('plc:syncFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="plc-sync-now">
      <span className="plc-sync-now__hint">
        {t(task === 'posts' ? 'plc:syncPostsHint' : 'plc:syncPluginsHint')}
      </span>
      <Button buttonStyle="secondary" disabled={busy} margin={false} onClick={run} size="small">
        {t('plc:syncNow')}
      </Button>
    </div>
  )
}
