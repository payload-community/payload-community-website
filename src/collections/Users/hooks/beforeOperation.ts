import crypto from 'node:crypto'

import { Forbidden, ValidationError, type CollectionBeforeOperationHook } from 'payload'

import { isAdmin } from '@/access'

export const MIN_PASSWORD_LENGTH = 10

export const randomPassword = (): string => crypto.randomBytes(32).toString('hex')

const REGISTRATION_FIELDS = ['name', 'email', 'password'] as const

const assertPasswordLength = (password: unknown) => {
  if (typeof password === 'string' && password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError({
      collection: 'users',
      errors: [
        {
          message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
          path: 'password',
        },
      ],
    })
  }
}

/**
 * - Blocks Payload's first-user registration (first admins come from ADMIN_* env vars or the dev seed).
 * - Anonymous creates are self-registrations: only name, email and password are kept, and Payload
 *   sends the activation email.
 * - Admin-created users get a random password, are verified, and receive an invitation instead.
 * - Trusted creates (OAuth, seeds) that pass `_verified: true` skip the activation email.
 */
export const usersBeforeOperation: CollectionBeforeOperationHook<'users'> = ({ args, operation, req }) => {
  if (operation === 'create') {
    if (req.pathname?.endsWith('/first-register')) throw new Forbidden(req.t)

    const data: Record<string, unknown> = { ...(args.data ?? {}) }

    if (isAdmin(req.user)) {
      data._verified = true
      data.password = randomPassword()
      return { ...args, data, disableVerificationEmail: true }
    }

    if (args.overrideAccess) {
      if (data._verified === true) {
        if (!data.password) data.password = randomPassword()
        return { ...args, data, disableVerificationEmail: true }
      }
      return args
    }

    if (!req.user) {
      const registration = Object.fromEntries(
        REGISTRATION_FIELDS.filter((key) => key in data).map((key) => [key, data[key]]),
      )
      assertPasswordLength(registration.password)
      return { ...args, data: registration }
    }

    return args
  }

  if ((operation === 'update' || operation === 'resetPassword') && !args.overrideAccess) {
    assertPasswordLength((args.data as { password?: unknown } | undefined)?.password)
  }

  return args
}
