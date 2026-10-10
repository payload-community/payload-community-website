import { Trans } from '@lingui/react/macro'
import clsx from 'clsx'
import React from 'react'

interface Props {
  className?: string
}

/** Text wordmark: the portal is not affiliated with Payload, so it does not use Payload's logo. */
export const Logo = ({ className }: Props) => {
  return (
    <span className={clsx('flex flex-col leading-tight font-semibold', className)}>
      <span className="text-lg">
        <Trans comment="First line of the site wordmark in the header and footer">
          Payload CMS
        </Trans>
      </span>
      <span className="text-xs font-normal uppercase tracking-widest opacity-70">
        <Trans comment="Second line of the site wordmark, below 'Payload CMS'">
          Community Portal
        </Trans>
      </span>
    </span>
  )
}
