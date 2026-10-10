# ADR-030: Runtime sitemaps, robots.txt and default social image

- Status: Proposed
- Proposed: 2026-10-10

## Context

The template runs the `next-sitemap` CLI after `next build`. It writes `public/robots.txt` and `public/sitemap.xml` with the site URL known **at build time**. The container image is built once without production settings ([ADR-013](0013-next-public-env-at-runtime.md), [ADR-028](0028-website-chrome-runtime-config-and-consent.md)), so these files would point to the wrong host. The template also ships Payload's own Open Graph image (`website-template-OG.webp`) and `twitter:creator: @payloadcms`, which contradicts the "not affiliated" note.

## Decision

- Drop the `next-sitemap` CLI step and `next-sitemap.config.cjs`; keep the `next-sitemap` package only for its XML helpers (`getServerSideSitemap`, `getServerSideSitemapIndex`).
- Route handlers render at request time with `NEXT_PUBLIC_SERVER_URL`:
  - `/robots.txt` disallows `/admin`, `/api/`, `/account`, `/next/`, `/sign-in`, `/submit/` and lists every sitemap.
  - `/sitemap.xml` is a sitemap index of `/pages-sitemap.xml` (CMS pages and the four listings) and `/news-sitemap.xml` (community posts), `/resources-sitemap.xml`, `/plugins-sitemap.xml` and `/builds-sitemap.xml`.
  - Section sitemaps are cached with `unstable_cache` (tags `<section>-sitemap`, invalidated by the moderation hooks of [ADR-029](0029-website-page-caching-and-revalidation.md), 1-hour fallback).
- Default social image: `/og-image.png`, a static route handler using Next's built-in `ImageResponse` (text wordmark), used when a page has no own image. Not the `opengraph-image` file convention, because file-based metadata would override per-post images.
- The layout's metadata (`generateMetadata`) sets the site name and a translated description; no `twitter:creator`.

## Consequences

- No build-time URL baking; one more small request-time render per crawler visit (cached data).
- Imported posts link to their source site and are not in our sitemaps.
