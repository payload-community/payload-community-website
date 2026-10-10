import type { Messages } from '@lingui/core'
import React from 'react'

import { LinguiClientProvider } from '@/lingui/ClientProvider'
import { ConsentProvider } from '@/website/consent/ConsentProvider'

import { HeaderThemeProvider } from './HeaderTheme'
import { ThemeProvider } from './Theme'

export const Providers: React.FC<{
  children: React.ReactNode
  locale: string
  messages: Messages
}> = ({ children, locale, messages }) => {
  return (
    <LinguiClientProvider locale={locale} messages={messages}>
      <ConsentProvider>
        <ThemeProvider>
          <HeaderThemeProvider>{children}</HeaderThemeProvider>
        </ThemeProvider>
      </ConsentProvider>
    </LinguiClientProvider>
  )
}
