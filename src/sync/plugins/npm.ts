import { z } from 'zod'

const registrySchema = z.object({
  'dist-tags': z.object({ latest: z.string().optional() }).partial().optional(),
  time: z.record(z.string(), z.string()).optional(),
})

const downloadsSchema = z.object({ downloads: z.number() })

export type NpmInfo = {
  npmLastPublishedAt: string | null
  npmLatestVersion: string | null
  npmWeeklyDownloads: number | null
}

export const EMPTY_NPM_INFO: NpmInfo = {
  npmLastPublishedAt: null,
  npmLatestVersion: null,
  npmWeeklyDownloads: null,
}

/** npm package names (scoped or not), as allowed in URLs. */
const NPM_NAME = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/

export const isValidPackageName = (name: string): boolean => NPM_NAME.test(name)

/**
 * Name of the root package to install, or null for private packages, monorepo roots without a
 * publishable package and invalid files (spec §11.2 step 3).
 */
export const packageNameFrom = (packageJson: unknown): string | null => {
  if (!packageJson || typeof packageJson !== 'object') return null
  const pkg = packageJson as {
    name?: unknown
    private?: unknown
    version?: unknown
    workspaces?: unknown
  }
  if (pkg.private === true || typeof pkg.name !== 'string') return null
  if (pkg.workspaces && typeof pkg.version !== 'string') return null
  return isValidPackageName(pkg.name) ? pkg.name : null
}

const registryPath = (name: string) => name.replace('/', '%2F')

const RETRYABLE = new Set([429, 500, 502, 503, 504])
const MAX_RETRY_DELAY_MS = 30_000

export type NpmFetchOptions = {
  /** First retry delay without a `Retry-After` header; doubles per attempt. */
  retryDelayMs?: number
  retries?: number
}

/** npm's downloads API answers bursts with 429; retries honour `Retry-After`. */
async function fetchWithRetry(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  { retries = 4, retryDelayMs = 1000 }: NpmFetchOptions,
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(15_000) })
    if (!RETRYABLE.has(res.status) || attempt >= retries) return res
    const retryAfter = Number(res.headers.get('retry-after'))
    const delay = retryAfter > 0 ? retryAfter * 1000 : retryDelayMs * 2 ** attempt
    await new Promise((resolve) => setTimeout(resolve, Math.min(delay, MAX_RETRY_DELAY_MS)))
  }
}

export type NpmLookup = NpmInfo & {
  /** The downloads API kept failing; callers keep the stored download count. */
  downloadsUnavailable?: true
}

/**
 * Latest version, its publish date and last week's downloads; null when the package does not
 * exist. Registry errors throw; a failing downloads API only sets `downloadsUnavailable`.
 */
export async function fetchNpmInfo(
  name: string,
  fetchImpl: typeof fetch = fetch,
  options: NpmFetchOptions = {},
): Promise<NpmLookup | null> {
  if (!isValidPackageName(name)) return null

  const registry = await fetchWithRetry(
    fetchImpl,
    `https://registry.npmjs.org/${registryPath(name)}`,
    { headers: { accept: 'application/json' } },
    options,
  )
  if (registry.status === 404) return null
  if (!registry.ok) throw new Error(`npm registry ${name}: HTTP ${registry.status}`)
  const meta = registrySchema.parse(await registry.json())
  const latest = meta['dist-tags']?.latest ?? null
  const info: NpmLookup = {
    npmLastPublishedAt:
      latest && meta.time?.[latest] ? new Date(meta.time[latest]).toISOString() : null,
    npmLatestVersion: latest,
    npmWeeklyDownloads: null,
  }

  const stats = await fetchWithRetry(
    fetchImpl,
    `https://api.npmjs.org/downloads/point/last-week/${name}`,
    {},
    options,
  )
  if (stats.ok) info.npmWeeklyDownloads = downloadsSchema.parse(await stats.json()).downloads
  else if (stats.status !== 404) info.downloadsUnavailable = true
  return info
}
