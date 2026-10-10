# Architecture decision records

One file per decision: `NNNN-short-kebab-title.md`. Numbers are never reused; `ADR-NNN` in the text refers to these files.

## Rules

- A new decision gets the next number and starts as **Proposed**; it becomes **Accepted** after the user's review.
- Accepted ADRs are not rewritten. To change a decision, add a new ADR that **supersedes** it, and set the old one's status to `Superseded by ADR-NNN`. Small clarifications made during the review that introduced the ADR are recorded with a `Revised:` line.
- Library choices record weekly downloads, last publish date and compatibility with our Payload, Next.js and React versions ([ADR-016](0016-libraries.md)).
- Ambiguities resolved with the least-effort reversible option are also listed in [`../open-questions.md`](../open-questions.md).

## Template

```markdown
# ADR-NNN: Title

- Status: Proposed | Accepted | Superseded by ADR-NNN | Deprecated
- Proposed: YYYY-MM-DD
- Accepted: YYYY-MM-DD

## Context
What problem, which constraints, which options were considered.

## Decision
What we do.

## Consequences
What becomes easier or harder; follow-up work; risks.
```

ADR-001 to ADR-022 were written as a single log during M0 and keep their original free-form layout; new ADRs use the template.

## Index

| # | Title | Status | Date |
|---|---|---|---|
| [001](0001-oauth-plugin-payload-oauth2.md) | OAuth plugin: `payload-oauth2` | Accepted | 2026-10-10 |
| [002](0002-admin-created-accounts-invitation.md) | Users: admin-created accounts get an invitation via `forgotPassword` | Accepted | 2026-10-10 |
| [003](0003-moderation-drafts-and-status-group.md) | Moderation = Payload drafts + `moderation` group | Accepted | 2026-10-10 |
| [004](0004-first-admin-and-first-register.md) | First admin and first-register screen | Accepted | 2026-10-10 |
| [005](0005-oauth-requires-verified-email.md) | OAuth sign-up requires a verified email | Accepted | 2026-10-10 |
| [006](0006-storage-s3-garage-public-endpoint.md) | Storage: `@payloadcms/storage-s3`, files served by Garage's public web endpoint | Accepted | 2026-10-10 |
| [007](0007-jobs-worker-and-scheduling.md) | Jobs and scheduling in Kubernetes | Accepted | 2026-10-10 |
| [008](0008-submission-limit-without-locking.md) | Submission limit: hook-based, no locking | Accepted | 2026-10-10 |
| [009](0009-migrations-and-seeding-job.md) | Migrations and seeding | Accepted | 2026-10-10 |
| [010](0010-single-image-for-all-roles.md) | One image for web, worker and migrate | Superseded by 023 | 2026-10-10 |
| [011](0011-account-deletion-anonymizes-content.md) | Account deletion anonymizes all content | Accepted | 2026-10-10 |
| [012](0012-sync-updates-with-pending-drafts.md) | Sync updates on documents with a pending draft | Accepted | 2026-10-10 |
| [013](0013-next-public-env-at-runtime.md) | `NEXT_PUBLIC_*` at runtime | Accepted | 2026-10-10 |
| [014](0014-versions.md) | Versions | Accepted | 2026-10-10 |
| [015](0015-template-features-removed.md) | Template features removed | Accepted | 2026-10-10 |
| [016](0016-libraries.md) | Libraries | Accepted | 2026-10-10 |
| [017](0017-public-reads-through-access-control.md) | Public reads go through access control | Accepted | 2026-10-10 |
| [018](0018-post-sync-specifics.md) | Post sync specifics (verified against live data 2026-10-09) | Accepted | 2026-10-10 |
| [019](0019-detail-pages.md) | Detail pages for Resources, Plugins and Builds (extends the brief) | Accepted | 2026-10-10 |
| [020](0020-email-registration-with-activation.md) | Email registration with activation link (extends the brief) | Accepted | 2026-10-10 |
| [021](0021-connect-providers-while-signed-in.md) | Connect providers while signed in (approved idea I1) | Accepted | 2026-10-10 |
| [022](0022-privacy-policy-content.md) | Privacy policy content | Accepted | 2026-10-10 |
| [023](0023-small-image-with-bundled-cli-scripts.md) | Small image: Next.js standalone output plus a bundled CLI script | Accepted | 2026-10-10 |
| [024](0024-unique-optional-fields-partial-indexes.md) | Unique-when-set fields use partial unique indexes | Accepted | 2026-10-10 |
