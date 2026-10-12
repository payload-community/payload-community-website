import { retry } from '@octokit/plugin-retry'
import { throttling } from '@octokit/plugin-throttling'
import { Octokit } from '@octokit/rest'
import type { Payload } from 'payload'
import { z } from 'zod'

export const SEARCH_QUERY = 'topic:payload-plugin fork:true'
/** GitHub returns at most this many results per search (spec §11.2, T4). */
export const SEARCH_RESULT_CAP = 1000

export const repoSchema = z.object({
  archived: z.boolean(),
  created_at: z.string(),
  description: z.string().nullish(),
  fork: z.boolean(),
  forks_count: z.number(),
  full_name: z.string(),
  homepage: z.string().nullish(),
  html_url: z.string(),
  license: z.object({ spdx_id: z.string().nullish() }).nullish(),
  name: z.string(),
  owner: z.object({ avatar_url: z.string().nullish() }).nullish(),
  pushed_at: z.string().nullish(),
  stargazers_count: z.number(),
  topics: z.array(z.string()).nullish(),
})

export type GitHubRepo = z.infer<typeof repoSchema>

export type SearchResult = {
  /** True when GitHub reported incomplete results or more results than it returns. */
  incomplete: boolean
  invalid: number
  repos: GitHubRepo[]
  totalCount: number
}

/** The GitHub calls the plugin sync needs; tests pass a fake. */
export interface GitHubClient {
  getPackageJson(fullName: string): Promise<unknown | null>
  getRepo(fullName: string): Promise<GitHubRepo | null>
  searchPluginRepos(): Promise<SearchResult>
}

const isNotFound = (err: unknown): boolean => (err as { status?: number })?.status === 404

const split = (fullName: string) => {
  const [owner, repo] = fullName.split('/')
  return { owner, repo }
}

export function createGitHubClient(
  token: string | undefined,
  logger: Payload['logger'],
): GitHubClient {
  const ThrottledOctokit = Octokit.plugin(throttling, retry)
  const octokit = new ThrottledOctokit({
    auth: token || undefined,
    throttle: {
      onRateLimit: (retryAfter, options, _octokit, retryCount) => {
        logger.warn({ retryAfter, url: options.url }, 'sync plugins: GitHub rate limit hit')
        return retryCount < 2
      },
      onSecondaryRateLimit: (retryAfter, options) => {
        logger.warn(
          { retryAfter, url: options.url },
          'sync plugins: GitHub secondary rate limit hit',
        )
        return true
      },
    },
    userAgent: 'payload-cms-community-portal',
  })

  return {
    async getPackageJson(fullName) {
      try {
        const { data } = await octokit.rest.repos.getContent({
          ...split(fullName),
          path: 'package.json',
        })
        if (Array.isArray(data) || data.type !== 'file' || !('content' in data)) return null
        return JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'))
      } catch (err) {
        if (isNotFound(err) || err instanceof SyntaxError) return null
        throw err
      }
    },
    async getRepo(fullName) {
      try {
        const { data } = await octokit.rest.repos.get(split(fullName))
        return repoSchema.parse(data)
      } catch (err) {
        if (isNotFound(err)) return null
        throw err
      }
    },
    async searchPluginRepos() {
      let totalCount = 0
      let incomplete = false
      const items = await octokit.paginate(
        octokit.rest.search.repos,
        { per_page: 100, q: SEARCH_QUERY, sort: 'updated' },
        (response) => {
          const data = response.data as unknown as {
            incomplete_results?: boolean
            total_count?: number
          }
          totalCount = data.total_count ?? totalCount
          incomplete ||= Boolean(data.incomplete_results)
          return response.data as unknown as unknown[]
        },
      )
      const repos: GitHubRepo[] = []
      let invalid = 0
      for (const item of items) {
        const parsed = repoSchema.safeParse(item)
        if (parsed.success) repos.push(parsed.data)
        else invalid++
      }
      return {
        incomplete: incomplete || totalCount > SEARCH_RESULT_CAP,
        invalid,
        repos,
        totalCount,
      }
    },
  }
}
