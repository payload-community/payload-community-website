import { msg } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import React from 'react'

import { isProviderEnabled } from '@/auth/oauth'
import { initLingui } from '@/lingui/server'
import { AuthLayout, OAuthButtons } from '@/website/auth/components'
import { websiteReturnPath } from '@/website/auth/schemas'
import { getCurrentUser } from '@/website/auth/session'
import { SignUpForm } from '@/website/auth/SignUpForm'
import { pageMetadata } from '@/website/metadata'

type Args = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const TITLE = msg({ comment: 'Page title of the registration page', message: 'Create an account' })

export function generateMetadata(): Metadata {
  const i18n = initLingui()
  return pageMetadata({
    description: i18n._(
      msg`Join with GitHub, Google or email to submit news, resources, plugins and builds.`,
    ),
    path: '/sign-up',
    title: i18n._(TITLE),
  })
}

export default async function SignUpPage({ searchParams }: Args) {
  const i18n = initLingui()
  const next = websiteReturnPath((await searchParams).next)
  if (await getCurrentUser()) redirect(next === '/' ? '/account' : next)

  const providers = (['github', 'google'] as const).filter(isProviderEnabled)
  const signInHref = next === '/' ? '/sign-in' : `/sign-in?next=${encodeURIComponent(next)}`

  return (
    <AuthLayout
      description={
        <Trans>
          Join the community to submit news, resources, plugins and builds. Moderators review every
          submission before it is published.
        </Trans>
      }
      title={i18n._(TITLE)}
    >
      <OAuthButtons providers={providers} returnPath={next} />
      <SignUpForm />
      <p className="text-sm text-muted-foreground">
        <Trans>
          Already have an account?{' '}
          <Link className="text-foreground underline" href={signInHref}>
            Sign in
          </Link>
        </Trans>
      </p>
    </AuthLayout>
  )
}
