'use client'

import { useAuth, useDocumentInfo, useFormFields, useFormModified, useTranslation } from '@payloadcms/ui'
import React from 'react'

import { isModerator } from '@/access'
import type { PlcTranslationKeys, PlcTranslations } from '@/i18n'

import { isModeratedCollection, type ModerationAction, type ModerationStatus } from '../config'
import { ActionButtons } from './ActionButtons'

const AUTHOR_ACTIONS: ModerationAction[] = ['unpublish']

/**
 * Sidebar UI field of moderated collections: moderation actions for moderators and admins, and
 * Unpublish for the author of a published entry.
 */
export function ModerationActions() {
  const { user } = useAuth()
  const { collectionSlug, hasPublishedDoc, id } = useDocumentInfo()
  const status = useFormFields(([fields]) => fields['moderation.status']?.value) as
    | ModerationStatus
    | undefined
  const createdBy = useFormFields(([fields]) => fields.createdBy?.value)
  const modified = useFormModified()
  const { t } = useTranslation<PlcTranslations, PlcTranslationKeys>()

  if (!user || !id || !status || !collectionSlug || !isModeratedCollection(collectionSlug)) return null

  const moderator = isModerator(user)
  const author = createdBy != null && String(createdBy) === String(user.id)
  if (!moderator && !(author && hasPublishedDoc && status !== 'unpublished')) return null

  return (
    <div className="plc-moderation-actions field-type">
      <span className="field-label">{t('plc:moderation')}</span>
      <ActionButtons
        collection={collectionSlug}
        disabled={modified}
        hasPublishedDoc={hasPublishedDoc}
        id={id}
        onDone={() => window.location.reload()}
        only={moderator ? undefined : AUTHOR_ACTIONS}
        status={status}
      />
      {!moderator && <p className="plc-moderation-actions__hint">{t('plc:authorUnpublishHint')}</p>}
      {modified && <p className="plc-moderation-actions__hint">{t('plc:moderationUnsavedChanges')}</p>}
    </div>
  )
}
