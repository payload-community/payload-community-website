# ADR-031: Sync implementation details

- Status: Proposed
- Proposed: 2026-10-11

## Context

Implementing the post and plugin syncs (M5, [§11](../architecture/sync.md)) against the live Payload blog API and GitHub showed cases the brief and spec did not cover, and some choices were left open: how failures map to job retries, what manual reruns refresh, and how manual triggers behave when a job is already waiting.

Observed on 2026-10-11: real blog excerpts are Lexical, only the 2038 placeholder post uses a Slate array; about a third of the posts are guest posts (`authorType: 'guest'`, `guestAuthor` string, empty `authors`); video posts have no `image` but have a `thumbnail` (sometimes also `meta.image`). GitHub returns `homepage: ''` for many repositories, `description: null` for some, and `license.spdx_id: 'NOASSERTION'` for unknown licenses.

## Decision

1. **Post mapping**: the author is `guestAuthor` for guest posts; the summary reads Lexical or Slate excerpts; the image is `image`, else `thumbnail`, else `meta.image`. The post slug is `{slugify(source.name)}-{slug}`, set once on create. Items that fail validation are skipped and counted, they do not fail the source.
2. **Incremental paging**: the adapter stops at the first page without a new post (as specified), capped at 20 pages. Edits to older posts are therefore picked up only when they share a page with a new post. A full re-sync is possible by clearing the source's posts.
3. **Images**: a failed download never fails the post: a new post is created without an image, an existing post keeps its previous one.
4. **Imported plugin fields**: `description` falls back to `full_name` when GitHub has none (the field is required); `homepage` is kept only when it is an absolute http(s) URL.
5. **Freshness window 12 h instead of 24 h**: when `pushed_at` is unchanged and `lastSyncedAt` is newer than 12 h, the run skips `package.json` and npm calls, writes only GitHub counters and does not bump `lastSyncedAt`. 12 h keeps the daily schedule a full refresh while making a same-day manual rerun cheap. A `lastSyncedAt`-only change is written with `payload.db.updateOne`, so it never adds a version.
6. **Retries**: `syncPosts` fails the job (and is retried, 2 retries) only when every processed source failed; `syncPlugins` fails when the GitHub search failed. Partial results are recorded on the source / in the job output and are not retried.
7. **Manual trigger deduplication**: `POST /api/sync/:task` returns `202 { alreadyQueued: true, jobId }` when a job of the task is queued, running or waiting for a retry, matching Payload's default `beforeSchedule` rule.
8. **npm rate limits**: npm calls run at concurrency 2 and retry HTTP 429/5xx up to 4 times with `Retry-After` or exponential backoff (a small loop in `src/sync/plugins/npm.ts`, no library). A download count that still cannot be fetched is kept from the previous run and counted as `npmFailures` (run status `partial`) instead of failing the repository. Measured on 2026-10-12 against the live API: without retries 202 of 301 repositories failed; with them about 6 download counts per full run stay stale. A bulk lookup is proposed as idea I17.
9. **Sync writes on imported entries** use the same draft-safe path as manual plugins ([ADR-012](0012-sync-updates-with-pending-drafts.md)): when the latest version is a draft (an edit by a moderator, or an unpublished entry), the main document and the draft are patched without publishing.

## Consequences

- No new libraries beyond [ADR-016](0016-libraries.md).
- Older post edits can lag until a new post appears; acceptable for a news feed that links to the source.
- A broken npm registry or a single repository failure gives `partial`, visible in the job log and on Sources, but does not retry the whole run.
