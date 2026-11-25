import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)
import { redirects } from './redirects'

const serverHostname = process.env.NEXT_PUBLIC_SERVER_URL
  ? new URL(process.env.NEXT_PUBLIC_SERVER_URL).hostname
  : undefined

const nextConfig: NextConfig = {
  // The dev server is reached through the DDEV router (e.g. https://plc.ddev.site).
  allowedDevOrigins: serverHostname ? [serverHostname] : [],
  output: 'standalone',
  // E2E runs a second dev server next to `pnpm dev`; each needs its own build directory.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  experimental: {
    // @lingui/swc-plugin is pinned exactly: it must match the swc_core of Next's bundled SWC (ADR-027).
    swcPlugins: [['@lingui/swc-plugin', {}]],
  },
  // Temporarily required on Windows until Next.js fixes Turbopack Sass resolution.
  // See: https://github.com/vercel/next.js/issues/86431
  sassOptions: {
    loadPaths: ['./node_modules/@payloadcms/ui/dist/scss/'],
  },
  images: {
    // Relative URLs still use /_next/image. Absolute file URLs use /media-image (ADR-033).
    // In DDEV, garage.plc.ddev.site resolves to a private IP; the local optimizer keeps its guard.
    dangerouslyAllowLocalIP: process.env.NODE_ENV === 'development',
    loader: 'custom',
    loaderFile: './src/imageLoader.ts',
    qualities: [75, 100],
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
