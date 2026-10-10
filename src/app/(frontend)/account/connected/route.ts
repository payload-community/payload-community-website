import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

import { CONNECT_COOKIE } from '@/auth/connectIntent'
import { getServerSideURL } from '@/utilities/getURL'

const REASONS = new Set(['email_unverified', 'oauth', 'provider_conflict', 'provider_in_use'])

/** OAuth return target of the connect flow: drops the one-time intent cookie, then shows `/account`. */
export async function GET(request: NextRequest) {
  const jar = await cookies()
  jar.delete({ name: CONNECT_COOKIE, path: '/' })

  const error = request.nextUrl.searchParams.get('error')
  const target = new URL('/account', getServerSideURL())
  if (error) target.searchParams.set('error', REASONS.has(error) ? error : 'oauth')
  else target.searchParams.set('connected', '1')
  return NextResponse.redirect(target, 303)
}
