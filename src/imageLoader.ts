type LoaderArgs = { quality?: number; src: string; width: number }

/**
 * Relative uploads stay on Next's optimizer. Absolute file URLs go through `/media-image`,
 * which allowlists hosts from the runtime environment (ADR-033). `remotePatterns` is fixed
 * when the image is built, so it cannot name the deployment's file host.
 */
export default function imageLoader({ quality, src, width }: LoaderArgs): string {
  const params = new URLSearchParams({
    q: String(quality ?? 75),
    url: src,
    w: String(width),
  })

  if (src.startsWith('/') && !src.startsWith('//')) return `/_next/image?${params}`
  return `/media-image?${params}`
}
