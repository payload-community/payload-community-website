import { Trans } from '@lingui/react/macro'
import Link from 'next/link'
import React from 'react'

import { CMSLink } from '@/components/Link'
import { Logo } from '@/components/Logo/Logo'
import { getCachedGlobal } from '@/utilities/getGlobals'
import { CookieSettingsButton } from '@/website/consent/ConsentProvider'

const linkClassName = 'text-sm text-white/80 hover:text-white hover:underline'

export async function Footer() {
  const footerData = await getCachedGlobal('footer', 1)()
  const navItems = footerData?.navItems || []

  return (
    <footer className="mt-auto border-t border-border bg-black text-white dark:bg-card">
      <div className="container flex flex-col gap-8 py-8 md:flex-row md:items-start md:justify-between">
        <div className="flex max-w-md flex-col gap-4">
          <Link className="w-fit" href="/">
            <Logo />
          </Link>
          <p className="text-sm text-white/70" data-testid="not-affiliated-note">
            <Trans>
              Payload CMS Community Portal is a community project. It is not affiliated with or
              endorsed by Payload.
            </Trans>
          </p>
        </div>
        <nav className="flex flex-col gap-3 md:flex-row md:gap-6">
          {navItems.map(({ link }, i) => (
            <CMSLink className={linkClassName} key={i} {...link} />
          ))}
          <CookieSettingsButton className={`${linkClassName} text-left`} />
        </nav>
      </div>
    </footer>
  )
}
