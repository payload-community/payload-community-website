import { msg } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import React from 'react'

import { isProviderEnabled } from '@/auth/oauth'
import { initLingui } from '@/lingui/server'
import { AuthLayout, OAuthButtons, QueryNotice } from '@/website/auth/components'
import { websiteReturnPath } from '@/website/auth/schemas'
import { getCurrentUser } from '@/website/auth/session'
import { SignInForm } from '@/website/auth/SignInForm'
import { pageMetadata } from '@/website/metadata'

type Args = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const TITLE = msg({ comment: 'Page title of the sign-in page', message: 'Sign in' })

export function generateMetadata(): Metadata {
  const i18n = initLingui()
  return pageMetadata({
    description: i18n._(msg`Sign in to submit news, resources, plugins and builds.`),
    noIndex: true,
    path: '/sign-in',
    title: i18n._(TITLE),
  })
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export default async function SignInPage({ searchParams }: Args) {
  const i18n = initLingui()
  const params = await searchParams
  const next = websiteReturnPath(params.next)
  if (await getCurrentUser()) redirect(next)

  const providers = (['github', 'google'] as const).filter(isProviderEnabled)
  const signUpHref = next === '/' ? '/sign-up' : `/sign-up?next=${encodeURIComponent(next)}`

  return (
    <AuthLayout
      description={<Trans>Sign in with GitHub, Google or your email address.</Trans>}
      title={i18n._(TITLE)}
    >
      <QueryNotice codes={[first(params.error), params.deleted ? 'deleted' : null]} />
      <OAuthButtons providers={providers} returnPath={next} />
      <SignInForm next={next} />
      <p className="text-sm text-muted-foreground">
        <Trans>
          New here?{' '}
          <Link className="text-foreground underline" href={signUpHref}>
            Create an account
          </Link>
        </Trans>
      </p>
    </AuthLayout>
  )
}
