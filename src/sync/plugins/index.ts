import pLimit from 'p-limit'
import type { Payload } from 'payload'

import type { Plugin } from '@/payload-types'

import { changedFields, SYNC_CONTEXT, updateSyncedEntry } from '../write'
import { createGitHubClient, type GitHubClient, type GitHubRepo, type SearchResult } from './github'
import { githubFields, importedFields, keepRepo } from './mapper'
import {
  EMPTY_NPM_INFO,
  fetchNpmInfo,
  packageNameFrom,
  type NpmFetchOptions,
  type NpmInfo,
} from './npm'

const CONCURRENCY = 4
/** npm's downloads API rate-limits bursts (HTTP 429). */
const NPM_CONCURRENCY = 2
/** Plugins refreshed more recently than this and not pushed since keep their npm data (manual reruns). */
export const REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000

export type PluginSyncStats = {
  created: number
  failed: number
  hidden: number
  manualMissing: number
  manualRefreshed: number
  /** Download counts that could not be refreshed (kept from the previous run). */
  npmFailures: number
  skipped: number
  unchanged: number
  unhidden: number
  updated: number
}

export type PluginSyncResult = PluginSyncStats & {
  error?: string
  incomplete: boolean
  searchTotal: number
  status: 'failed' | 'partial' | 'success'
}

export type SyncPluginsOptions = {
  fetch?: typeof fetch
  github?: GitHubClient
  now?: Date
  npm?: NpmFetchOptions
}

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err))

const npmFieldsOf = (plugin: Plugin): NpmInfo => ({
  npmLastPublishedAt: plugin.npmLastPublishedAt ?? null,
  npmLatestVersion: plugin.npmLatestVersion ?? null,
  npmWeeklyDownloads: plugin.npmWeeklyDownloads ?? null,
})

export async function syncPlugins(
  payload: Payload,
  options: SyncPluginsOptions = {},
): Promise<PluginSyncResult> {
  const github = options.github ?? createGitHubClient(process.env.GITHUB_TOKEN, payload.logger)
  const fetchImpl = options.fetch ?? fetch
  const now = options.now ?? new Date()
  const limit = pLimit(CONCURRENCY)
  const npmLimit = pLimit(NPM_CONCURRENCY)
  const stats: PluginSyncStats = {
    created: 0,
    failed: 0,
    hidden: 0,
    manualMissing: 0,
    manualRefreshed: 0,
    npmFailures: 0,
    skipped: 0,
    unchanged: 0,
    unhidden: 0,
    updated: 0,
  }

  const { docs: plugins } = await payload.find({
    collection: 'plugins',
    depth: 0,
    draft: true,
    pagination: false,
  })
  const byFullName = new Map(
    plugins.filter((p) => p.fullName).map((p) => [p.fullName!.toLowerCase(), p]),
  )

  const isFresh = (plugin: Plugin | undefined, pushedAt: string | null): boolean =>
    Boolean(
      plugin?.lastSyncedAt &&
      (plugin.lastPushedAt ?? null) === pushedAt &&
      now.getTime() - new Date(plugin.lastSyncedAt).getTime() < REFRESH_INTERVAL_MS,
    )

  const npmInfo = async (
    name: string | null | undefined,
    current: Plugin | undefined,
  ): Promise<NpmInfo> => {
    if (!name) return EMPTY_NPM_INFO
    const info = await npmLimit(() => fetchNpmInfo(name, fetchImpl, options.npm))
    if (!info) return EMPTY_NPM_INFO
    const { downloadsUnavailable, ...fields } = info
    if (!downloadsUnavailable) return fields
    stats.npmFailures++
    payload.logger.warn({ npmPackage: name }, 'sync plugins: npm downloads unavailable')
    return { ...fields, npmWeeklyDownloads: current?.npmWeeklyDownloads ?? null }
  }

  /** Creates or updates; `fresh` plugins only get their GitHub counters, without a new `lastSyncedAt`. */
  const write = async (
    existing: Plugin | undefined,
    fields: Record<string, unknown>,
    fresh: boolean,
  ) => {
    const data = fresh ? fields : { ...fields, lastSyncedAt: now.toISOString() }
    if (!existing) {
      await payload.create({
        collection: 'plugins',
        context: SYNC_CONTEXT,
        data: { ...data, _status: 'published', origin: 'imported' } as never,
        draft: false,
      })
      stats.created++
      return
    }
    const { lastSyncedAt, ...changes } = changedFields(existing, data)
    if (Object.keys(changes).length > 0) {
      await updateSyncedEntry(payload, 'plugins', existing.id, {
        ...changes,
        ...(lastSyncedAt ? { lastSyncedAt } : {}),
      })
      stats.updated++
    } else {
      if (lastSyncedAt)
        await payload.db.updateOne({
          collection: 'plugins',
          data: { lastSyncedAt },
          id: existing.id,
        })
      stats.unchanged++
    }
  }

  const upsertRepo = async (repo: GitHubRepo) => {
    const existing = byFullName.get(repo.full_name.toLowerCase())
    const gh = githubFields(repo)
    const fresh = isFresh(existing, gh.lastPushedAt)

    if (existing && existing.origin !== 'imported') {
      const npm = fresh ? npmFieldsOf(existing) : await npmInfo(existing.npmPackage, existing)
      await write(existing, { ...gh, ...npm }, fresh)
      return
    }

    let npmPackage = existing?.npmPackage ?? null
    let npm = existing ? npmFieldsOf(existing) : EMPTY_NPM_INFO
    if (!fresh) {
      npmPackage = packageNameFrom(await github.getPackageJson(repo.full_name))
      npm = await npmInfo(npmPackage, existing)
    }
    if (existing?.hidden) stats.unhidden++
    await write(
      existing,
      { ...gh, ...importedFields(repo), ...npm, hidden: false, npmPackage },
      fresh,
    )
  }

  let search: SearchResult | null = null
  let error: string | undefined
  try {
    search = await github.searchPluginRepos()
  } catch (err) {
    error = errorMessage(err)
    payload.logger.error({ err: error }, 'sync plugins: GitHub search failed')
  }

  const seen = new Set<string>()
  if (search) {
    const unique = new Map(search.repos.map((repo) => [repo.full_name.toLowerCase(), repo]))
    stats.skipped += search.invalid
    await Promise.all(
      [...unique].map(([fullName, repo]) =>
        limit(async () => {
          if (!keepRepo(repo)) {
            stats.skipped++
            return
          }
          seen.add(fullName)
          try {
            await upsertRepo(repo)
          } catch (err) {
            stats.failed++
            payload.logger.error(
              { err: errorMessage(err), fullName },
              'sync plugins: repository failed',
            )
          }
        }),
      ),
    )

    if (search.incomplete) {
      payload.logger.warn(
        { totalCount: search.totalCount },
        'sync plugins: incomplete search, hiding skipped',
      )
    } else {
      for (const plugin of plugins) {
        if (
          plugin.origin !== 'imported' ||
          plugin.hidden ||
          !plugin.fullName ||
          seen.has(plugin.fullName.toLowerCase())
        )
          continue
        try {
          await updateSyncedEntry(payload, 'plugins', plugin.id, { hidden: true })
          stats.hidden++
        } catch (err) {
          stats.failed++
          payload.logger.error(
            { err: errorMessage(err), fullName: plugin.fullName },
            'sync plugins: hiding failed',
          )
        }
      }
    }
  }

  const manual = plugins.filter(
    (p) => p.origin !== 'imported' && !(p.fullName && seen.has(p.fullName.toLowerCase())),
  )
  await Promise.all(
    manual.map((plugin) =>
      limit(async () => {
        try {
          let gh: ReturnType<typeof githubFields> | Record<string, never> = {}
          if (plugin.fullName) {
            const repo = await github.getRepo(plugin.fullName)
            if (repo) gh = githubFields(repo)
            else {
              stats.manualMissing++
              payload.logger.warn(
                { fullName: plugin.fullName, id: plugin.id },
                'sync plugins: manual repository not found',
              )
            }
          }
          const fresh = isFresh(
            plugin,
            'lastPushedAt' in gh ? gh.lastPushedAt : (plugin.lastPushedAt ?? null),
          )
          const npm = fresh ? npmFieldsOf(plugin) : await npmInfo(plugin.npmPackage, plugin)
          await write(plugin, { ...gh, ...npm }, fresh)
          stats.manualRefreshed++
        } catch (err) {
          stats.failed++
          payload.logger.error(
            { err: errorMessage(err), id: plugin.id },
            'sync plugins: manual plugin failed',
          )
        }
      }),
    ),
  )

  const status: PluginSyncResult['status'] = !search
    ? 'failed'
    : stats.failed > 0 || stats.npmFailures > 0 || search.incomplete
      ? 'partial'
      : 'success'
  return {
    ...stats,
    error,
    incomplete: search?.incomplete ?? false,
    searchTotal: search?.totalCount ?? 0,
    status,
  }
}
