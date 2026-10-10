'use client'

import { useDocumentInfo, useFormFields, useTranslation } from '@payloadcms/ui'
import React, { useEffect, useState } from 'react'

import type { PlcTranslationKeys, PlcTranslations } from '@/i18n'

/**
 * The admin create view always requires a password for auth collections. Admin-created users get a
 * random password on the server and an invitation email, so the inputs are pre-filled and hidden.
 * Payload replaces the form state after mount (and merges server state on changes), so the value is
 * re-applied whenever the form state no longer contains it.
 */
export const HidePasswordOnCreate: React.FC = () => {
  const { id } = useDocumentInfo()
  const [fields, dispatchFields] = useFormFields((context) => context)
  const [placeholder] = useState(() => crypto.randomUUID() + crypto.randomUUID())
  const { t } = useTranslation<PlcTranslations, PlcTranslationKeys>()

  useEffect(() => {
    if (id) return
    for (const path of ['password', 'confirm-password']) {
      if (fields[path]?.value !== placeholder) {
        dispatchFields({ type: 'UPDATE', path, valid: true, value: placeholder })
      }
    }
  }, [dispatchFields, fields, id, placeholder])

  if (id) return null

  return (
    <>
      <style>{`.collection-edit--users .auth-fields__changing-password { display: none; }`}</style>
      <p className="field-description">{t('plc:invitationNotice')}</p>
    </>
  )
}
