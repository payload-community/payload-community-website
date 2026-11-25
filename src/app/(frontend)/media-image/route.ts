import { NextResponse } from 'next/server'
import sharp from 'sharp'

import { MediaImageRequestError, parseMediaImageQuery } from '@/utilities/mediaImage'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_BYTES = 50_000_000

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)

  try {
    const { quality, target, width } = parseMediaImageQuery({
      q: searchParams.get('q'),
      url: searchParams.get('url'),
      w: searchParams.get('w'),
    })
    const upstream = await fetch(target, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
    })

    if (upstream.status >= 300 && upstream.status < 400) {
      return new NextResponse('redirects are not followed', { status: 400 })
    }
    if (!upstream.ok) return new NextResponse('upstream failed', { status: 502 })

    const type = upstream.headers.get('content-type') ?? ''
    if (!type.startsWith('image/')) return new NextResponse('not an image', { status: 400 })

    const declared = Number(upstream.headers.get('content-length') || 0)
    if (declared > MAX_BYTES) return new NextResponse('image too large', { status: 413 })

    const input = Buffer.from(await upstream.arrayBuffer())
    if (input.length > MAX_BYTES) return new NextResponse('image too large', { status: 413 })

    const output = await sharp(input)
      .rotate()
      .resize({ fit: 'inside', width, withoutEnlargement: true })
      .webp({ quality })
      .toBuffer()

    return new NextResponse(new Uint8Array(output), {
      headers: {
        'Cache-Control': 'public, max-age=14400',
        'Content-Type': 'image/webp',
      },
    })
  } catch (error) {
    if (error instanceof MediaImageRequestError) {
      return new NextResponse(error.message, { status: error.status })
    }
    if (error instanceof Error && error.name === 'TimeoutError') {
      return new NextResponse('upstream timed out', { status: 504 })
    }
    return new NextResponse('image could not be optimized', { status: 400 })
  }
}
