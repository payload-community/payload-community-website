# ADR-029: Website page caching and revalidation

- Status: Accepted
- Proposed: 2026-10-10
- Accepted: 2026-10-11

## Context

[§14](../architecture/frontend.md#14-website-routes) asks for detail pages with `generateStaticParams` and "on-demand revalidation by cache tag (`afterChange` hooks)". Three facts make tags alone insufficient:

- The Payload Local API does not use `fetch`, so its results carry no cache tags unless every query is wrapped in `unstable_cache`.
- Sync jobs ([§9](sync.md)) run in the worker process (`node cli.mjs worker`), which has no Next.js cache to invalidate; `revalidatePath` throws outside a Next.js request.
- The Helm chart allows several web replicas; each has its own Next.js cache, and a revalidation call only reaches the replica that handled the request.

## Decision

- **Listings** (`/news`, `/resources`, `/plugins`, `/builds`) read `searchParams` and are rendered per request (always fresh).
- **Detail pages** (`/news/[slug]`, `/resources/[slug]`, `/plugins/[slug]`, `/builds/[slug]`) are prerendered from `generateStaticParams` (up to 1,000 recent slugs each; newer ones render on first request) with `export const revalidate = 300` as a time-based fallback.
- **On-demand:** the moderated collections get shared `afterChange`/`afterDelete` hooks (`src/moderation/revalidate.ts`). When an entry is or was published, they call `revalidatePath` for its detail page and `/` (home lists), and `revalidateTag('<section>-sitemap')`. Calls go through `safeRevalidate` (`src/website/revalidate.ts`), which ignores the error outside Next.js; `context.disableRevalidate` skips them (seeds).
- Draft previews use Next.js draft mode through the template's `/next/preview` route; moderated collections get an admin "Preview" button, and detail pages then read the signed-in user's latest draft through access control.

## Consequences

- Admin and moderation changes are visible immediately on the replica that handled them and within 5 minutes everywhere else; sync job updates (stars, versions) appear within 5 minutes.
- No shared cache handler is needed for multi-replica deployments. If 5 minutes turns out to be too slow, a shared cache handler (e.g. Redis) can replace it later.
- The admin's draft preview of a page renders dynamically and is never cached.
