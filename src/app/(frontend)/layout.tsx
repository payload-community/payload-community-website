import type { Metadata } from 'next'

import { cn } from '@/utilities/ui'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import React from 'react'

import { AdminBar } from '@/components/AdminBar'
import { Footer } from '@/Footer/Component'
import { Header } from '@/Header/Component'
import { getCatalog, initLingui, type Locale } from '@/lingui/server'
import { Providers } from '@/providers'
import { InitTheme } from '@/providers/Theme/InitTheme'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { draftMode } from 'next/headers'

import './globals.css'
import { getServerSideURL } from '@/utilities/getURL'
import { SITE_DESCRIPTION, SITE_NAME } from '@/website/metadata'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { isEnabled } = await draftMode()
  const i18n = initLingui()

  return (
    <html
      className={cn(GeistSans.variable, GeistMono.variable)}
      lang={i18n.locale}
      suppressHydrationWarning
    >
      <head>
        <InitTheme />
        <link href="/favicon.ico" rel="icon" sizes="32x32" />
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
      </head>
      <body>
        <Providers locale={i18n.locale} messages={getCatalog(i18n.locale as Locale)}>
          <AdminBar
            adminBarProps={{
              preview: isEnabled,
            }}
          />

          <Header />
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  )
}

export function generateMetadata(): Metadata {
  const i18n = initLingui()
  const description = i18n._(SITE_DESCRIPTION)
  return {
    description,
    metadataBase: new URL(getServerSideURL()),
    openGraph: mergeOpenGraph({ description }),
    title: SITE_NAME,
    twitter: { card: 'summary_large_image' },
  }
}
