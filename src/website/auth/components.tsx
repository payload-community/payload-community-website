import { Trans, useLingui } from '@lingui/react/macro'
import React from 'react'

import { Button } from '@/components/ui/button'
import type { OAuthProvider } from '@/auth/oauth/resolveOAuthAccount'
import { cn } from '@/utilities/ui'

import { AUTH_NOTICES, PROVIDER_NAMES } from './messages'

export const AuthLayout: React.FC<{
  children: React.ReactNode
  description?: React.ReactNode
  title: string
}> = ({ children, description, title }) => (
  <div className="container flex justify-center py-16">
    <div className="flex w-full max-w-md flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-2 text-muted-foreground">{description}</p>}
      </header>
      {children}
    </div>
  </div>
)

export const Notice: React.FC<{
  children: React.ReactNode
  tone: 'error' | 'info'
  testId?: string
}> = ({ children, testId, tone }) => (
  <div
    className={cn(
      'rounded-md border px-4 py-3 text-sm',
      tone === 'error' ? 'border-error bg-error/30' : 'border-success bg-success/30',
    )}
    data-testid={testId ?? 'auth-notice'}
    role={tone === 'error' ? 'alert' : 'status'}
  >
    {children}
  </div>
)

/** Notice for the first known code among the given query params. */
export const QueryNotice: React.FC<{ codes: (string | null | undefined)[] }> = ({ codes }) => {
  const { i18n } = useLingui()
  const code = codes.find((c): c is string => Boolean(c && AUTH_NOTICES[c]))
  if (!code) return null
  const notice = AUTH_NOTICES[code]!
  return <Notice tone={notice.tone}>{i18n._(notice.message)}</Notice>
}

export const OAuthButtons: React.FC<{ providers: OAuthProvider[]; returnPath: string }> = ({
  providers,
  returnPath,
}) => {
  if (!providers.length) return null
  return (
    <div className="flex flex-col gap-3">
      {providers.map((provider) => {
        const name = PROVIDER_NAMES[provider]
        return (
          <Button asChild key={provider} size="lg" variant="outline">
            <a
              data-testid={`oauth-${provider}`}
              href={`/api/users/oauth/${provider}?state=${encodeURIComponent(returnPath)}`}
            >
              <Trans comment="Sign-in button, e.g. 'Continue with GitHub'">
                Continue with {name}
              </Trans>
            </a>
          </Button>
        )
      })}
      <p className="flex items-center gap-3 text-xs uppercase text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
        <Trans comment="Separator between GitHub/Google buttons and the email form">
          or use email
        </Trans>
      </p>
    </div>
  )
}
