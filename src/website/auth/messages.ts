import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'

/** Codes from `?error=` / `?…=1` query params on the auth pages. */
export const AUTH_NOTICES: Record<string, { message: MessageDescriptor; tone: 'error' | 'info' }> =
  {
    confirm_delete: {
      message: msg`Tick the confirmation box to delete your account.`,
      tone: 'error',
    },
    connected: { message: msg`The account was connected.`, tone: 'info' },
    deleted: { message: msg`Your account was deleted.`, tone: 'info' },
    disconnected: { message: msg`The account was disconnected.`, tone: 'info' },
    email_unverified: {
      message: msg`Your GitHub or Google account has no verified email address. Verify it there first, or sign up with email.`,
      tone: 'error',
    },
    oauth: {
      message: msg({
        comment: 'GitHub/Google sign-in failed for an unknown reason',
        message: 'Signing in did not work. Please try again.',
      }),
      tone: 'error',
    },
    provider_conflict: {
      message: msg`An account with this email is already connected to a different GitHub or Google account. Sign in with that account or with your password.`,
      tone: 'error',
    },
    provider_in_use: {
      message: msg`This GitHub or Google account is already connected to another account on this site.`,
      tone: 'error',
    },
  }

// eslint-disable-next-line lingui/no-unlocalized-strings -- brand names
export const PROVIDER_NAMES = { github: 'GitHub', google: 'Google' } as const
