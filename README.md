# Payload Community

A community portal for [Payload CMS](https://payloadcms.com): news, resources, plugins and builds, with community submissions and moderation. Built on Payload 3 (Website template), Next.js and MongoDB. Not affiliated with Payload CMS, Inc.

> **Status: alpha (`0.1.0-alpha.1`).** Features are complete for local use and testing; production deployment artifacts (container image, Helm chart, observability, security headers) are still on the [roadmap](spec/roadmap.md). Do not expose this version to the internet yet. See the [changelog](CHANGELOG.md) for what is included and the known limitations.

## Features

- **Website**: news (imported from the Payload blog plus community posts), resources, plugins and builds, with search, filters, sorting and detail pages; light and dark theme; SEO metadata, sitemaps and a consent-gated Google Analytics.
- **Accounts**: GitHub and Google sign-in, email/password registration with activation, admin invitations, self-service account deletion.
- **Community submissions with pre-moderation**: users submit in the Payload admin panel; moderators approve, reject or unpublish from a moderation dashboard; authors and moderators get email notifications; at most 3 pending submissions per user.
- **Synchronization jobs**: blog posts every 6 hours, GitHub plugins (with npm data) daily, plus manual "Sync now" for admins.

## Running it

Local development runs in [DDEV](https://ddev.com/):

```bash
pnpm install
pnpm migrate && pnpm seed:dev
pnpm dev            # https://plc.ddev.site (website) and /admin
```

Details, environment variables and test accounts: [Getting started](docs/getting-started.md). Outside DDEV the alpha runs from source with `pnpm build && pnpm start` (web, `JOBS_AUTORUN=false`) and `pnpm worker` (jobs), given MongoDB, an S3-compatible bucket and SMTP. MongoDB must be reachable during `pnpm build` too (pages are prerendered from the database).

## Documentation

- [Docs index](docs/README.md): getting started, website development, moderation guide, synchronization guide.
- [Specification](spec/README.md): brief, architecture, decisions (ADRs), open questions and the [roadmap](spec/roadmap.md).
- [AGENTS.md](AGENTS.md): rules and commands for coding agents and contributors.

## License

MIT © Payload Community, see [LICENSE.md](LICENSE.md). Parts derived from the Payload Website template keep the Payload CMS, Inc. notice.
