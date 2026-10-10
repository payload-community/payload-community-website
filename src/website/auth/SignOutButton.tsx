'use client'

import { Trans } from '@lingui/react/macro'
import { useRouter } from 'next/navigation'
import React from 'react'

import { Button } from '@/components/ui/button'

export const SignOutButton: React.FC = () => {
  const router = useRouter()
  return (
    <Button
      onClick={async () => {
        await fetch('/api/users/logout', { credentials: 'include', method: 'POST' }).catch(() => null)
        router.push('/')
        router.refresh()
      }}
      type="button"
      variant="outline"
    >
      <Trans comment="Button that ends the session">Sign out</Trans>
    </Button>
  )
}
