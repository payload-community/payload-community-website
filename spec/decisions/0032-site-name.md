# ADR-032: Public site name is Payload Community

- Status: Accepted
- Proposed: 2026-11-25
- Accepted: 2026-11-25

## Context

The brief names this site **Payload CMS Community Portal**. The Payload project is dropping the "CMS" suffix, and the owner asked to drop both "CMS" and "Portal" from this site's name. The wordmark in [ADR-028](0028-website-chrome-runtime-config-and-consent.md) was "Payload CMS / Community Portal".

`pnpm seed` never updates an existing document, so already-seeded Home, About and privacy pages would keep the old name unless a migration rewrites it.

## Decision

- The public name is **Payload Community**: wordmark, document titles, admin title suffix, Open Graph site name, default social image, emails, and seeded Home, About and privacy copy. The constant is `SITE_NAME` in `src/website/siteName.ts`.
- The wordmark stays two lines, now "Payload" and "Community" (the second line is still uppercased with CSS). This supersedes only the wordmark wording in ADR-028.
- **Payload CMS** stays where the text means the product: the site description, links to payloadcms.com, "Payload CMS, Inc.", and technical package names.
- **portal** stays as an ordinary word ("this portal", "on the portal", "a community portal") and in identifiers that are not the public name (`payload-community-portal`, the planned Helm chart `payload-cms-community-portal`).
- Migration `20261125_145500_site_name` replaces the previous name in existing `pages` and `posts` documents and their versions. Seed behavior is unchanged.

## Consequences

- `spec/BRIEF.md` and `spec/bootstrap-prompt.md` still use the old name until the owner applies P13 in [`open-questions.md`](../open-questions.md).
- Suggested OAuth application names in `docs/getting-started.md` follow the new name. Existing OAuth apps keep working if their display name is left as it is.
- A later edit that introduces the old name is not rewritten again; the migration runs once.
