'use client'
import { useHeaderTheme } from '@/providers/HeaderTheme'
import { useLingui } from '@lingui/react/macro'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useEffect, useState } from 'react'

import type { Header } from '@/payload-types'

import { Logo } from '@/components/Logo/Logo'
import { ThemeSelector } from '@/providers/Theme/ThemeSelector'
import { AccountMenu } from './AccountMenu'
import { HeaderNav } from './Nav'

interface HeaderClientProps {
  data: Header
}

export const HeaderClient: React.FC<HeaderClientProps> = ({ data }) => {
  const { t } = useLingui()
  /* Storing the value in a useState to avoid hydration errors */
  const [theme, setTheme] = useState<string | null>(null)
  const { headerTheme, setHeaderTheme } = useHeaderTheme()
  const pathname = usePathname()

  useEffect(() => {
    setHeaderTheme(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (headerTheme && headerTheme !== theme) setTheme(headerTheme)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerTheme])

  return (
    <header className="container relative z-20" {...(theme ? { 'data-theme': theme } : {})}>
      <div className="flex items-center justify-between gap-4 py-6">
        <Link
          aria-label={t({
            comment: 'Accessible name of the site wordmark link in the header',
            message: 'Payload CMS Community Portal, home',
          })}
          href="/"
        >
          <Logo />
        </Link>
        <div className="flex items-center gap-2 lg:gap-4">
          <HeaderNav data={data} />
          <ThemeSelector />
          <AccountMenu />
        </div>
      </div>
    </header>
  )
}
