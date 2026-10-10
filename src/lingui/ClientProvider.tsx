'use client'

import { setupI18n, type Messages } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import React, { useState } from 'react'

export const LinguiClientProvider: React.FC<{
  children: React.ReactNode
  locale: string
  messages: Messages
}> = ({ children, locale, messages }) => {
  const [i18n] = useState(() => setupI18n({ locale, messages: { [locale]: messages } }))

  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}
