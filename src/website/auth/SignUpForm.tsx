'use client'

import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import Link from 'next/link'
import React, { useActionState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { signUp } from './actions'
import { Notice } from './components'
import {
  MIN_PASSWORD_LENGTH,
  type SignUpError,
  type SignUpField,
  type SignUpState,
} from './schemas'

const FIELD_ERRORS: Record<SignUpField, Partial<Record<SignUpError, MessageDescriptor>>> = {
  confirm: { mismatch: msg`The passwords do not match.` },
  email: {
    invalid: msg`Enter a valid email address.`,
    required: msg`Enter your email address.`,
    too_long: msg`This email address is too long.`,
  },
  name: { required: msg`Enter your name.`, too_long: msg`Use at most 100 characters.` },
  password: {
    too_long: msg`This password is too long.`,
    too_short: msg`Use at least ${MIN_PASSWORD_LENGTH} characters.`,
  },
  privacy: { required: msg`Please confirm that you have read the privacy policy.` },
}

const FieldError: React.FC<{ field: SignUpField; state: SignUpState }> = ({ field, state }) => {
  const { i18n } = useLingui()
  if (state.status !== 'invalid' || !state.errors[field]) return null
  const descriptor = FIELD_ERRORS[field][state.errors[field]!]
  return (
    <p className="text-sm text-destructive" id={`sign-up-${field}-error`}>
      {descriptor ? i18n._(descriptor) : null}
    </p>
  )
}

export const SignUpForm: React.FC = () => {
  const { t } = useLingui()
  const [state, action, pending] = useActionState(signUp, { status: 'idle' } as SignUpState)

  if (state.status === 'sent') {
    return (
      <Notice testId="sign-up-sent" tone="info">
        <p className="font-medium">
          <Trans>Check your inbox</Trans>
        </p>
        <p className="mt-1">
          <Trans>
            We sent an activation link to your email address. Open it to activate your account, then
            sign in.
          </Trans>
        </p>
      </Notice>
    )
  }

  const values = state.status === 'invalid' ? state.values : { email: '', name: '' }
  const invalid = (field: SignUpField) =>
    state.status === 'invalid' && state.errors[field]
      ? { 'aria-describedby': `sign-up-${field}-error`, 'aria-invalid': true }
      : {}

  return (
    <form action={action} className="flex flex-col gap-4" data-testid="sign-up-form" noValidate>
      {state.status === 'failed' && (
        <Notice tone="error">
          <Trans>Creating the account did not work. Please try again later.</Trans>
        </Notice>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sign-up-name">
          <Trans comment="Form field label: the person's display name">Name</Trans>
        </Label>
        <Input
          autoComplete="name"
          defaultValue={values.name}
          id="sign-up-name"
          name="name"
          required
          {...invalid('name')}
        />
        <FieldError field="name" state={state} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sign-up-email">
          <Trans comment="Form field label">Email</Trans>
        </Label>
        <Input
          autoComplete="email"
          defaultValue={values.email}
          id="sign-up-email"
          name="email"
          required
          type="email"
          {...invalid('email')}
        />
        <FieldError field="email" state={state} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sign-up-password">
          <Trans comment="Form field label">Password</Trans>
        </Label>
        <Input
          autoComplete="new-password"
          id="sign-up-password"
          minLength={MIN_PASSWORD_LENGTH}
          name="password"
          required
          type="password"
          {...invalid('password')}
        />
        <FieldError field="password" state={state} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sign-up-confirm">
          <Trans comment="Form field label: type the password a second time">Repeat password</Trans>
        </Label>
        <Input
          autoComplete="new-password"
          id="sign-up-confirm"
          name="confirm"
          required
          type="password"
          {...invalid('confirm')}
        />
        <FieldError field="confirm" state={state} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="flex items-start gap-2 text-sm" htmlFor="sign-up-privacy">
          <input
            className="mt-1"
            id="sign-up-privacy"
            name="privacy"
            required
            type="checkbox"
            {...invalid('privacy')}
          />
          <span>
            <Trans>
              I have read the{' '}
              <Link className="underline" href="/privacy" target="_blank">
                privacy policy
              </Link>
              .
            </Trans>
          </span>
        </label>
        <FieldError field="privacy" state={state} />
      </div>
      <Button disabled={pending} size="lg" type="submit">
        {pending
          ? t({ comment: 'Sign-up button while the request runs', message: 'Creating account…' })
          : t({ comment: 'Submit button of the sign-up form', message: 'Create account' })}
      </Button>
    </form>
  )
}
