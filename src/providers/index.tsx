import type { Messages } from '@lingui/core'
import React from 'react'

import { LinguiClientProvider } from '@/lingui/ClientProvider'

import { HeaderThemeProvider } from './HeaderTheme'
import { ThemeProvider } from './Theme'

export const Providers: React.FC<{
  children: React.ReactNode
  locale: string
  messages: Messages
}> = ({ children, locale, messages }) => {
  return (
    <LinguiClientProvider locale={locale} messages={messages}>
      <ThemeProvider>
        <HeaderThemeProvider>{children}</HeaderThemeProvider>
      </ThemeProvider>
    </LinguiClientProvider>
  )
}
