import { z } from 'zod'

export const MIN_PASSWORD_LENGTH = 10
export const MAX_PASSWORD_LENGTH = 256

export type SignUpField = 'confirm' | 'email' | 'name' | 'password' | 'privacy'
export type SignUpError = 'invalid' | 'mismatch' | 'required' | 'too_long' | 'too_short'

export const signUpSchema = z
  .object({
    confirm: z.string(),
    email: z.string().trim().min(1, 'required').max(254, 'too_long').pipe(z.email('invalid')),
    name: z.string().trim().min(1, 'required').max(100, 'too_long'),
    password: z.string().min(MIN_PASSWORD_LENGTH, 'too_short').max(MAX_PASSWORD_LENGTH, 'too_long'),
    privacy: z.literal('on', 'required'),
  })
  .refine((data) => data.password === data.confirm, { message: 'mismatch', path: ['confirm'] })

export type SignUpState =
  | { status: 'idle' }
  | { status: 'sent' }
  | { status: 'failed' }
  | {
      errors: Partial<Record<SignUpField, SignUpError>>
      status: 'invalid'
      values: { email: string; name: string }
    }

/** First error code per field from a failed parse. */
export const signUpErrors = (error: z.ZodError): Partial<Record<SignUpField, SignUpError>> => {
  const errors: Partial<Record<SignUpField, SignUpError>> = {}
  for (const issue of error.issues) {
    const field = issue.path[0] as SignUpField
    if (!errors[field]) errors[field] = (issue.message as SignUpError) || 'invalid'
  }
  return errors
}

export const providerSchema = z.enum(['github', 'google'])

/** Relative path on this site to return to after signing in. */
export const websiteReturnPath = (next: string | string[] | undefined, fallback = '/'): string => {
  const value = Array.isArray(next) ? next[0] : next
  return value && /^\/(?!\/)[^\\\s]*$/.test(value) && !value.startsWith('/api/') ? value : fallback
}
