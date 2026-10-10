import { headers } from 'next/headers'

import type { User } from '@/payload-types'

import { getPayloadClient } from '../queries'

/** The signed-in user from the session cookie (makes the page dynamic). */
export const getCurrentUser = async (): Promise<User | null> => {
  const payload = await getPayloadClient()
  const { user } = await payload.auth({ headers: await headers() })
  return (user as User | null) ?? null
}
