'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ValidationError } from 'payload'

import { SUB_FIELDS } from '@/auth/oauth/resolveOAuthAccount'

import { getPayloadClient } from '../queries'
import { providerSchema, signUpErrors, signUpSchema, type SignUpState } from './schemas'
import { getCurrentUser } from './session'

/** Website registration (spec §12.2): same rules as an anonymous `POST /api/users`. */
export async function signUp(_previous: SignUpState, formData: FormData): Promise<SignUpState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return {
      errors: signUpErrors(parsed.error),
      status: 'invalid',
      values: {
        email: String(formData.get('email') ?? ''),
        name: String(formData.get('name') ?? ''),
      },
    }
  }

  const payload = await getPayloadClient()
  const { email, name, password } = parsed.data
  try {
    await payload.create({
      collection: 'users',
      data: { email: email.toLowerCase(), name, password },
      overrideAccess: false,
    })
  } catch (error) {
    // An existing email gets the same answer, so the form cannot be used to probe for accounts.
    if (error instanceof ValidationError && error.data.errors.some((e) => e.path === 'email')) {
      return { status: 'sent' }
    }
    payload.logger.error({ err: error, msg: 'Website sign-up failed' })
    return { status: 'failed' }
  }
  return { status: 'sent' }
}

export async function disconnectProvider(formData: FormData): Promise<void> {
  const provider = providerSchema.safeParse(formData.get('provider'))
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in?next=/account')
  if (!provider.success) redirect('/account')

  const payload = await getPayloadClient()
  await payload.update({
    collection: 'users',
    data: {
      [SUB_FIELDS[provider.data]]: null,
      ...(provider.data === 'github' ? { githubLogin: null } : {}),
    },
    id: user.id,
    overrideAccess: true,
  })
  payload.logger.info({
    msg: 'Disconnected OAuth provider',
    provider: provider.data,
    userId: user.id,
  })
  redirect('/account?disconnected=1')
}

/** Deletes the signed-in account; content is anonymized by the `beforeDelete` hook. */
export async function deleteAccount(formData: FormData): Promise<void> {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in?next=/account')
  if (formData.get('confirm') !== 'on') redirect('/account?error=confirm_delete')

  const payload = await getPayloadClient()
  await payload.delete({ collection: 'users', id: user.id, overrideAccess: false, user })
  const jar = await cookies()
  jar.delete({ name: `${payload.config.cookiePrefix}-token`, path: '/' })
  payload.logger.info({ msg: 'Account deleted by its owner', userId: user.id })
  redirect('/sign-in?deleted=1')
}
