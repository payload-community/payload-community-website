'use client'

import { useAuth, useDocumentInfo, useFormFields, useFormModified, useTranslation } from '@payloadcms/ui'
import React from 'react'

import { isModerator } from '@/access'
import type { PlcTranslationKeys, PlcTranslations } from '@/i18n'

import { isModeratedCollection, type ModerationStatus } from '../config'
import { ActionButtons } from './ActionButtons'

/** Sidebar UI field of moderated collections: moderation actions for moderators and admins. */
export function ModerationActions() {
  const { user } = useAuth()
  const { collectionSlug, hasPublishedDoc, id } = useDocumentInfo()
  const status = useFormFields(([fields]) => fields['moderation.status']?.value) as
    | ModerationStatus
    | undefined
  const modified = useFormModified()
  const { t } = useTranslation<PlcTranslations, PlcTranslationKeys>()

  if (!isModerator(user) || !id || !status || !collectionSlug || !isModeratedCollection(collectionSlug)) {
    return null
  }

  return (
    <div className="plc-moderation-actions field-type">
      <span className="field-label">{t('plc:moderation')}</span>
      <ActionButtons
        collection={collectionSlug}
        disabled={modified}
        hasPublishedDoc={hasPublishedDoc}
        id={id}
        onDone={() => window.location.reload()}
        status={status}
      />
      {modified && <p className="plc-moderation-actions__hint">{t('plc:moderationUnsavedChanges')}</p>}
    </div>
  )
}
