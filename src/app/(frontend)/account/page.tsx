import { msg } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import React from 'react'

import { isProviderEnabled } from '@/auth/oauth'
import { SUB_FIELDS, type OAuthProvider } from '@/auth/oauth/resolveOAuthAccount'
import { Button } from '@/components/ui/button'
import { initLingui } from '@/lingui/server'
import { deleteAccount, disconnectProvider } from '@/website/auth/actions'
import { Notice, QueryNotice } from '@/website/auth/components'
import { PROVIDER_NAMES } from '@/website/auth/messages'
import { getCurrentUser } from '@/website/auth/session'
import { SignOutButton } from '@/website/auth/SignOutButton'
import { Avatar, DetailSection } from '@/website/detail-components'
import { pageMetadata } from '@/website/metadata'

type Args = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const TITLE = msg({ comment: 'Page title of the account settings page', message: 'My account' })

export function generateMetadata(): Metadata {
  const i18n = initLingui()
  return pageMetadata({
    description: i18n._(msg`Your profile, connected accounts and account settings.`),
    noIndex: true,
    path: '/account',
    title: i18n._(TITLE),
  })
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

export default async function AccountPage({ searchParams }: Args) {
  const i18n = initLingui()
  const params = await searchParams
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in?next=/account')

  const providers = (['github', 'google'] as const).filter(
    (provider) => isProviderEnabled(provider) || Boolean(user[SUB_FIELDS[provider]]),
  )
  const connected = (provider: OAuthProvider) => Boolean(user[SUB_FIELDS[provider]])
  const connectedCount = providers.filter(connected).length
  const name = user.name || user.email
  const githubLogin = user.githubLogin

  return (
    <div className="container flex justify-center py-16">
      <div className="flex w-full max-w-2xl flex-col gap-10" data-testid="account-page">
        <header className="flex items-center gap-4">
          <Avatar size={64} url={user.avatarUrl} />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{i18n._(TITLE)}</h1>
            <p className="text-muted-foreground">
              {name}
              {user.name && <span> · {user.email}</span>}
            </p>
          </div>
        </header>

        <QueryNotice
          codes={[
            first(params.error),
            params.connected ? 'connected' : null,
            params.disconnected ? 'disconnected' : null,
          ]}
        />

        <DetailSection
          title={i18n._(msg({ comment: 'Account page section heading', message: 'Your content' }))}
        >
          <p className="text-sm text-muted-foreground">
            <Trans>
              Submissions are created and edited in the admin panel. Moderators review them before
              they are published.
            </Trans>
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/admin">
                <Trans comment="Link to the admin panel listing the user's own entries">
                  My entries
                </Trans>
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/account">
                <Trans comment="Link to profile and email notification settings in the admin panel">
                  Profile and notifications
                </Trans>
              </Link>
            </Button>
          </div>
        </DetailSection>

        {providers.length > 0 && (
          <DetailSection
            title={i18n._(
              msg({
                comment: 'Account page section: linked GitHub/Google accounts',
                message: 'Connected accounts',
              }),
            )}
          >
            <ul
              className="divide-y divide-border rounded-md border border-border"
              data-testid="connected-accounts"
            >
              {providers.map((provider) => {
                const providerName = PROVIDER_NAMES[provider]
                const isConnected = connected(provider)
                return (
                  <li
                    className="flex flex-wrap items-center justify-between gap-3 p-4"
                    key={provider}
                  >
                    <div>
                      <p className="font-medium">{providerName}</p>
                      <p className="text-sm text-muted-foreground">
                        {isConnected ? (
                          provider === 'github' && githubLogin ? (
                            <Trans comment="Connected GitHub account, e.g. 'Connected as octocat'">
                              Connected as {githubLogin}
                            </Trans>
                          ) : (
                            <Trans comment="Status of a linked GitHub/Google account">
                              Connected
                            </Trans>
                          )
                        ) : (
                          <Trans comment="Status of a GitHub/Google account that is not linked">
                            Not connected
                          </Trans>
                        )}
                      </p>
                      {isConnected && connectedCount === 1 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          <Trans>
                            After disconnecting, sign in with your email and password. If you never
                            set a password, use &quot;Forgot password?&quot; on the sign-in page.
                          </Trans>
                        </p>
                      )}
                    </div>
                    <form
                      action={isConnected ? disconnectProvider : '/account/connect'}
                      method="post"
                    >
                      <input name="provider" type="hidden" value={provider} />
                      <Button
                        data-testid={`${isConnected ? 'disconnect' : 'connect'}-${provider}`}
                        disabled={!isConnected && !isProviderEnabled(provider)}
                        type="submit"
                        variant="outline"
                      >
                        {isConnected ? (
                          <Trans comment="Button: unlink a GitHub/Google account, e.g. 'Disconnect GitHub'">
                            Disconnect {providerName}
                          </Trans>
                        ) : (
                          <Trans comment="Button: link a GitHub/Google account, e.g. 'Connect GitHub'">
                            Connect {providerName}
                          </Trans>
                        )}
                      </Button>
                    </form>
                  </li>
                )
              })}
            </ul>
          </DetailSection>
        )}

        <DetailSection
          title={i18n._(msg({ comment: 'Account page section heading', message: 'Password' }))}
        >
          <p className="text-sm text-muted-foreground">
            <Trans>
              Set a password to sign in with your email address, or change the one you have.
            </Trans>
          </p>
          <div>
            <Button asChild variant="outline">
              <Link href="/admin/account">
                <Trans comment="Link to the password form in the admin panel">
                  Set or change password
                </Trans>
              </Link>
            </Button>
          </div>
        </DetailSection>

        <DetailSection
          title={i18n._(
            msg({ comment: 'Account page section heading: end the session', message: 'Session' }),
          )}
        >
          <div>
            <SignOutButton />
          </div>
        </DetailSection>

        <DetailSection
          title={i18n._(
            msg({ comment: 'Account page section heading', message: 'Delete account' }),
          )}
        >
          <Notice testId="delete-account-warning" tone="error">
            <Trans>
              Deleting your account cannot be undone. Your published news, resources, plugins and
              builds stay on the site and are shown as submitted by a former member.
            </Trans>
          </Notice>
          <form
            action={deleteAccount}
            className="flex flex-col gap-3"
            data-testid="delete-account-form"
          >
            <label className="flex items-start gap-2 text-sm">
              <input className="mt-1" name="confirm" required type="checkbox" />
              <span>
                <Trans>I understand that my account will be deleted permanently.</Trans>
              </span>
            </label>
            <div>
              <Button type="submit" variant="destructive">
                <Trans comment="Button that permanently deletes the user's account">
                  Delete my account
                </Trans>
              </Button>
            </div>
          </form>
        </DetailSection>
      </div>
    </div>
  )
}
