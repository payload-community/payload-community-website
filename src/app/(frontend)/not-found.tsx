import { Trans } from '@lingui/react/macro'
import Link from 'next/link'
import React from 'react'

import { Button } from '@/components/ui/button'
import { initLingui } from '@/lingui/server'

export default function NotFound() {
  initLingui()

  return (
    <div className="container py-28">
      <div className="prose max-w-none">
        <h1 style={{ marginBottom: 0 }}>404</h1>
        <p className="mb-4">
          <Trans>This page could not be found.</Trans>
        </p>
      </div>
      <Button asChild variant="default">
        <Link href="/">
          <Trans>Go home</Trans>
        </Link>
      </Button>
    </div>
  )
}
