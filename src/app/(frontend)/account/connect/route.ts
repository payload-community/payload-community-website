import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

import {
  CONNECT_COOKIE,
  CONNECT_RETURN_PATH,
  CONNECT_TTL_SECONDS,
  signConnectIntent,
} from '@/auth/connectIntent'
import { isProviderEnabled } from '@/auth/oauth'
import { providerSchema } from '@/website/auth/schemas'
import { getCurrentUser } from '@/website/auth/session'
import { getPayloadClient } from '@/website/queries'
import { getServerSideURL } from '@/utilities/getURL'

const to = (path: string) => NextResponse.redirect(new URL(path, getServerSideURL()), 303)

/**
 * Starts linking GitHub or Google to the signed-in account (spec §12.3). A plain form POST, so the
 * browser follows the redirect chain to the provider; same-origin only.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(getServerSideURL()).origin) {
    return new Response(null, { status: 403 })
  }

  const user = await getCurrentUser()
  if (!user) return to('/sign-in?next=/account')

  const provider = providerSchema.safeParse((await request.formData()).get('provider'))
  if (!provider.success || !isProviderEnabled(provider.data)) return to('/account?error=oauth')

  const payload = await getPayloadClient()
  const jar = await cookies()
  jar.set(
    CONNECT_COOKIE,
    signConnectIntent({ provider: provider.data, userId: user.id }, payload.secret),
    {
      httpOnly: true,
      maxAge: CONNECT_TTL_SECONDS,
      path: '/',
      sameSite: 'lax',
      secure: getServerSideURL().startsWith('https://'),
    },
  )
  return to(`/api/users/oauth/${provider.data}?state=${encodeURIComponent(CONNECT_RETURN_PATH)}`)
}
