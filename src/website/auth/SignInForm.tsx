'use client'

import { Trans, useLingui } from '@lingui/react/macro'
import Link from 'next/link'
import React, { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { Notice } from './components'

type Status = 'idle' | 'submitting' | 'invalid' | 'unverified' | 'failed' | 'resent'

/** Password sign-in through Payload's `POST /api/users/login` (sets the session cookie). */
export const SignInForm: React.FC<{ next: string }> = ({ next }) => {
  const { t } = useLingui()
  const [status, setStatus] = useState<Status>('idle')
  const [email, setEmail] = useState('')

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setStatus('submitting')
    const response = await fetch('/api/users/login', {
      body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }).catch(() => null)

    if (response?.ok) {
      window.location.assign(next)
      return
    }
    setStatus(
      response?.status === 403 ? 'unverified' : response?.status === 401 ? 'invalid' : 'failed',
    )
  }

  const resend = async () => {
    setStatus('submitting')
    await fetch('/api/users/resend-activation', {
      body: JSON.stringify({ email }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }).catch(() => null)
    setStatus('resent')
  }

  return (
    <form className="flex flex-col gap-4" data-testid="sign-in-form" onSubmit={onSubmit}>
      {status === 'invalid' && (
        <Notice tone="error">
          <Trans>
            The email or password is incorrect. After 5 failed attempts the account is locked for 10
            minutes.
          </Trans>
        </Notice>
      )}
      {status === 'failed' && (
        <Notice tone="error">
          <Trans>Signing in did not work. Please try again.</Trans>
        </Notice>
      )}
      {status === 'unverified' && (
        <Notice tone="error">
          <p>
            <Trans>Please activate your account with the link we emailed you.</Trans>
          </p>
          <Button className="mt-2" onClick={resend} size="sm" type="button" variant="outline">
            <Trans comment="Button that sends the account activation email again">
              Send a new activation link
            </Trans>
          </Button>
        </Notice>
      )}
      {status === 'resent' && (
        <Notice tone="info">
          <Trans>
            If an account with this email is waiting for activation, we sent a new activation link.
          </Trans>
        </Notice>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sign-in-email">
          <Trans comment="Form field label">Email</Trans>
        </Label>
        <Input
          autoComplete="email"
          id="sign-in-email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="sign-in-password">
            <Trans comment="Form field label">Password</Trans>
          </Label>
          <Link className="text-sm text-muted-foreground underline" href="/admin/forgot">
            <Trans>Forgot password?</Trans>
          </Link>
        </div>
        <Input
          autoComplete="current-password"
          id="sign-in-password"
          name="password"
          required
          type="password"
        />
      </div>
      <Button disabled={status === 'submitting'} size="lg" type="submit">
        {status === 'submitting'
          ? t({ comment: 'Sign-in button while the request runs', message: 'Signing in…' })
          : t({ comment: 'Submit button of the sign-in form', message: 'Sign in' })}
      </Button>
    </form>
  )
}
