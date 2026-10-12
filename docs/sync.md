# Synchronization guide

The portal imports community content from two places:

- **Posts** from the sources listed under *Synchronization → Sources* (today the Payload blog), every 6 hours.
- **Plugins** from GitHub repositories with the `payload-plugin` topic, enriched with npm data, daily at 03:00 UTC.

Both run as background jobs on the `sync` queue. The design is in [spec §11](../spec/architecture/sync.md).

## Running a sync now

- **Admin panel**: *Sync now* on the Sources list (posts) or the Plugins list (plugins). Only admins see the button. The job runs within a minute; reload the list to see the results.
- **HTTP**, e.g. from a script or a CronJob:

  ```bash
  curl -X POST https://<site>/api/sync/posts -H "Authorization: Bearer $CRON_SECRET"
  curl -X POST https://<site>/api/sync/plugins -H "Authorization: Bearer $CRON_SECRET"
  # One source only:
  curl -X POST https://<site>/api/sync/posts -H "Authorization: Bearer $CRON_SECRET" \
    -H 'Content-Type: application/json' -d '{"sourceId":"<source id>"}'
  ```

  The response is `202` with the `jobId`. If a sync of the same kind is already queued or running, nothing new is queued and the response has `"alreadyQueued": true`.
- **Locally**: queued jobs run inside `pnpm dev` once a minute. Without the dev server, `pnpm payload jobs:run --queue sync` runs them once.

## Reading the results

- Each source shows *Last synchronization*: time, status (`success`, `partial`, `failed`), the last error and counters (created, updated, unchanged, skipped, image failures).
- Every run logs one line, `job syncPosts: finished` or `job syncPlugins: finished`, with the counters. Jobs and their output are also stored in the `payload-jobs` collection.
- A job is retried twice when the whole run failed: every source failed, or the GitHub search failed. Partial failures are not retried; the next scheduled run repeats the missing work.

## What the sync changes

- Imported posts and plugins are published directly and marked *Imported*; only admins can edit them. Entries a moderator unpublished stay unpublished.
- Plugins that disappear from the GitHub search are hidden, never deleted. They reappear when the repository comes back. Hiding is skipped when GitHub reports an incomplete search (more than 1,000 results).
- Plugins added by users keep their name, description and links; the sync only refreshes stars, license, npm version and downloads. A pending edit stays pending.
- Post images are downloaded once into *Post media*; a failed download does not block the post.

## Troubleshooting

| Symptom | Check |
|---|---|
| `syncPlugins` failed with a rate-limit or 401 error | `GITHUB_TOKEN` is set and valid; without it GitHub allows only 10 searches per minute. |
| Plugin sync is `partial` with `incomplete: true` | The `payload-plugin` topic has more than 1,000 repositories; see T4 in [`spec/open-questions.md`](../spec/open-questions.md). |
| A source is `failed` with `HTTP 4xx/5xx` | The source's `endpoint` URL; open it in a browser with `?limit=1`. |
| Posts have no images | `S3_*` settings and the job log line `sync posts: image download failed`. |
| A manual rerun did not update npm downloads | Expected within 12 hours of the last full refresh unless the repository was pushed. |
| Plugin sync is `partial` with `npmFailures` > 0 | npm rate-limited some download lookups even after retries; those plugins keep their previous count until the next run. A handful per run is normal. |
