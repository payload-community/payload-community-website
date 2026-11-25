# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/) with pre-release tags. Planned work is in [`spec/roadmap.md`](spec/roadmap.md).

## [Unreleased]

### Changed

- The public site name is **Payload Community** (wordmark, titles, emails, and seeded Home, About and privacy copy). "Payload CMS" stays where the text means the product. "portal" stays in ordinary descriptions and in technical identifiers such as the npm package name.

## [0.1.0-alpha.1] - 2026-11-24

First alpha: the bootstrap milestones M0–M5. It runs from source (`pnpm build && pnpm start` plus `pnpm worker`, or `pnpm dev` in DDEV). Production artifacts (container image, Helm chart, OpenTelemetry, health endpoints, security headers) are not included yet; **do not expose this version to the internet** before roadmap M6.

### Added

- **Website** (Next.js 16, Payload 3.90.2 Website template): home, Community, About and privacy pages from the layout builder; News, Resources, Plugins and Builds listings with search, filters, sorting and pagination in the URL; detail pages for community posts, resources, plugins and builds; light and dark theme; "not affiliated with Payload" footer note. All website strings use Lingui (English catalog).
- **Accounts**: GitHub and Google sign-in (linking only by verified email), email/password registration with an activation email, admin-created accounts with a 7-day "set your password" invitation, an account page to connect or disconnect providers and to delete the account (content is anonymized). Configured admins (`ADMIN_GITHUB_LOGINS`, `ADMIN_EMAILS`) get the admin role on sign-in.
- **Roles and access control**: visitors, users, moderators and admins; public reads only return published, non-hidden entries; owners see their own drafts; synced fields are read-only for everyone except admins.
- **Pre-moderation** for posts, resources, plugins and builds: Payload drafts plus a moderation status (pending, published, rejected, unpublished); the published version stays live while an edit waits for review; at most 3 pending submissions per regular user; authors can unpublish their own entries.
- **Moderation dashboard** in the admin panel (pending, rejected and unpublished tabs; approve, reject with a reason, re-publish, unpublish) and a pending-count widget.
- **Email notifications** through the jobs queue: new submissions to moderators, approvals and rejections to authors, invitations, activation and password reset; react-email templates with plain-text alternatives.
- **Post sync** every 6 hours from the Payload blog (`payload-rest` adapter behind a small adapter interface): guest authors, video thumbnails, Lexical and Slate excerpts, images downloaded once into S3.
- **Plugin sync** daily from GitHub (`topic:payload-plugin`, forks with more than 2 stars) with npm version and weekly downloads; manual plugins are merged and refreshed, vanished imported plugins are hidden and come back when found again; pending edits are never published by the sync.
- **Manual sync triggers**: `POST /api/sync/posts|plugins` for admins or `Bearer CRON_SECRET`, and "Sync now" buttons on the Sources and Plugins lists.
- **SEO and consent**: metadata and canonical URLs, JSON-LD, runtime sitemaps and `robots.txt`, a default social image; cookie banner with Google Analytics 4 loaded only after consent (Consent Mode v2).
- **Tooling**: `pnpm` scripts for migrations and seeds (production and dev), a standalone jobs worker, 117 Vitest unit and integration tests and 22 Playwright E2E tests against a separate `plc_test` database; specs, 31 ADRs and developer, moderator and sync guides.
- MIT license with Payload Community as copyright holder (the Website template's notice is kept).

### Known limitations

- No container image, Helm chart, health endpoints, OpenTelemetry, HTTP security headers or request rate limits yet (roadmap M6).
- `pnpm build` needs a reachable MongoDB (detail pages are prerendered from the database).
- No accessibility (axe) or Lighthouse checks yet; some E2E scenarios from the bootstrap test list are covered only by integration tests (roadmap M7).
- The GitHub and Google OAuth round trip has to be checked manually with real apps; only the account-linking logic is automated.
- The plugin sync usually ends as `partial`: npm rate-limits a few weekly-download lookups per run, and those plugins keep their previous count.
- The post sync picks up edits to older blog posts only when they share a page with a new post.

[Unreleased]: https://github.com/payload-community/payload-community-website/compare/v0.1.0-alpha.1...HEAD
[0.1.0-alpha.1]: https://github.com/payload-community/payload-community-website/releases/tag/v0.1.0-alpha.1
