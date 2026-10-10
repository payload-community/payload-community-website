import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)
import { redirects } from './redirects'

type RemotePattern = NonNullable<NonNullable<NextConfig['images']>['remotePatterns']>[number]

const toRemotePattern = (value: string | undefined): RemotePattern[] => {
  if (!value) return []
  const url = new URL(value)

  return [
    {
      hostname: url.hostname,
      pathname: `${url.pathname.replace(/\/+$/, '')}/**`,
      port: url.port,
      protocol: url.protocol.replace(':', '') as 'http' | 'https',
    },
  ]
}

const serverHostname = process.env.NEXT_PUBLIC_SERVER_URL
  ? new URL(process.env.NEXT_PUBLIC_SERVER_URL).hostname
  : undefined

const nextConfig: NextConfig = {
  // The dev server is reached through the DDEV router (e.g. https://plc.ddev.site).
  allowedDevOrigins: serverHostname ? [serverHostname] : [],
  // E2E runs a second dev server next to `pnpm dev`; each needs its own build directory.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Temporarily required on Windows until Next.js fixes Turbopack Sass resolution.
  // See: https://github.com/vercel/next.js/issues/86431
  sassOptions: {
    loadPaths: ['./node_modules/@payloadcms/ui/dist/scss/'],
  },
  images: {
    // In DDEV, garage.plc.ddev.site resolves to the router's private IP. Production keeps the SSRF guard.
    dangerouslyAllowLocalIP: process.env.NODE_ENV === 'development',
    qualities: [100],
    remotePatterns: [
      ...toRemotePattern(process.env.NEXT_PUBLIC_SERVER_URL),
      ...toRemotePattern(process.env.S3_PUBLIC_URL),
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  reactStrictMode: true,
  redirects,
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
