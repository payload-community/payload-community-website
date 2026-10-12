import { isHttpURL } from '@/fields/validateURL'

import type { GitHubRepo } from './github'

/** Original repositories always; forks only with more than 2 stars (brief, Plugin synchronization). */
export const keepRepo = (repo: Pick<GitHubRepo, 'fork' | 'stargazers_count'>): boolean =>
  !repo.fork || repo.stargazers_count > 2

/** GitHub fields every plugin gets from the sync, manual ones included (spec §11.2 mapping table). */
export const githubFields = (repo: GitHubRepo) => ({
  archived: repo.archived,
  forks: repo.forks_count,
  fullName: repo.full_name.toLowerCase(),
  githubCreatedAt: new Date(repo.created_at).toISOString(),
  isFork: repo.fork,
  lastPushedAt: repo.pushed_at ? new Date(repo.pushed_at).toISOString() : null,
  license:
    repo.license?.spdx_id && repo.license.spdx_id !== 'NOASSERTION' ? repo.license.spdx_id : null,
  ownerAvatarUrl: repo.owner?.avatar_url ?? null,
  stars: repo.stargazers_count,
  topics: repo.topics ?? [],
})

/** Fields an imported plugin also takes from GitHub; manual plugins keep the user's values. */
export const importedFields = (repo: GitHubRepo) => ({
  description: repo.description?.trim() || repo.full_name,
  homepage: repo.homepage && isHttpURL(repo.homepage) ? repo.homepage : null,
  name: repo.name,
  repositoryUrl: repo.html_url,
})
