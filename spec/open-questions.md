# Open questions

Open items first, then resolved ones (kept for traceability). Product questions are `Q<n>`, technical checks `T<n>`, proposed changes to read-only documents `P<n>`. Proposed changes to `spec/BRIEF.md` / `spec/bootstrap-prompt.md` are at the end.

## Open

**Q21. Moderation controls in the admin panel** (M3, decided as [ADR-026](decisions/0026-moderation-admin-controls.md), please confirm). Regular users only get *Save Draft*; Payload's *Unpublish* control is hidden (unpublishing is a moderation action) and its REST equivalent counts as `unpublish`; a moderator's *Publish changes* on someone else's unpublished entry counts as an approval and emails the author.

**Q22. Runtime client config and consent wiring** (M4, decided as [ADR-028](decisions/0028-website-chrome-runtime-config-and-consent.md), please confirm). Instead of a dynamic layout (ADR-013), client components read the GA ID from `GET /site-config.json` so pages stay static; Consent Mode v2 defaults are pushed by the consent provider right before GA loads (no inline head script); the header uses a text wordmark instead of Payload's logo; the admin bar is shown to moderators and admins only.

**Q23. Listing details not in the brief** (M4, least-effort choices, please confirm). Resources and builds can also be sorted by `newest` (creation date) besides `updated`; filtered/searched listing views are `noindex, follow` with the plain listing as canonical; pages past the last one return 404; each listing shows a "Submit …" button to `/submit/{collection}`; the post `source` filter uses the source ID (sources have no slug) and lists only sources with visible posts.

**Q24. Page caching** (M4, decided as [ADR-029](decisions/0029-website-page-caching-and-revalidation.md), please confirm). Instead of cache tags only, detail pages use `revalidate = 300` plus on-demand `revalidatePath` from the moderation hooks, because the jobs worker and other replicas cannot reach a replica's Next.js cache. Sync updates and changes on other replicas appear within 5 minutes.

### Verification tasks (agreed approach; confirm during implementation)

**T2. Lingui SWC plugin compatibility** (M4, decided as [ADR-027](decisions/0027-lingui-wiring.md), please confirm). 6.7.1 does not load with Next 16.3.3 (`swc_core` 73); `@lingui/swc-plugin` is pinned to 6.1.0, the newest release that compiles, with Lingui 6.9.0. `eslint-plugin-lingui` is added as a lint guardrail for unwrapped website strings.


## Resolved (2026-10-10 review)

| # | Question | Resolution |
|---|---|---|
| Q1 | OAuth accounts without a verified email | Refuse sign-in until the email is verified at the provider ([ADR-005](decisions/0005-oauth-requires-verified-email.md)). |
| Q2 | Linking providers with different emails | Same verified email links automatically; additionally users can connect providers from `/account` (idea I1 approved, [ADR-021](decisions/0021-connect-providers-while-signed-in.md)). |
| Q3 | Content of deleted users | Anonymize all content, in every status ([ADR-011](decisions/0011-account-deletion-anonymizes-content.md)). |
| Q4 | Rejected edit of a published entry | Published version stays live; author can edit again; no author "discard changes". |
| Q5 | Unpublish while an edit is pending | Latest draft becomes the hidden document; documented for moderators. |
| Q6 | Moderator drafts of new entries | Shown in the queue as `pending`, without notifications. |
| Q7 | Plugin sync freshness with a pending edit | `payload.db.updateOne` on the published document ([ADR-012](decisions/0012-sync-updates-with-pending-drafts.md)). |
| Q8 | Manual plugin merge | Keep the user's name/description/homepage; update only sync-owned fields. |
| Q9 | Moderators editing imported plugins | No; admins only. |
| Q10 | Admin role removal | No automatic revocation. |
| Q11 | Imported post tags | Source category name. |
| Q12 | Detail pages | Detail pages for Resources, Plugins and Builds ([ADR-019](decisions/0019-detail-pages.md)). |
| Q13 | Reset-password UX | Reuse Payload's admin reset/forgot views. |
| Q14 | Admins receive moderation emails | Yes, unless turned off. |
| Q15 | Privacy policy | Generated default page from the seed ([ADR-022](decisions/0022-privacy-policy-content.md)). |
| Q16 | Production email DNS | SPF/DKIM/DMARC listed in `docs/deployment.md` once the provider is chosen. |
| Q20 | Public file delivery | Garage's own web endpoint on its own public host; `S3_PUBLIC_URL` points to it; no separate CDN ([ADR-006](decisions/0006-storage-s3-garage-public-endpoint.md)). |
| Q17 | Sign-up with an already registered email | Generic "Check your inbox" answer; no email to the existing account in v1 (idea I15 kept for later). |
| Q18 | Unverified accounts cleanup | Keep them for now; no cleanup job. |
| Q19 | Bot protection on registration | No CAPTCHA in v1; rate limiting + email activation. |
| T1 | Admin create view without password fields | Checked in M2: the create view always requires a password (`requirePassword` for new docs), so the fallback is used — a UI field pre-fills and hides the inputs; the server sets a random password ([auth §12.2](architecture/auth.md#122-email-registration-and-password-sign-in)). |
| T6 | Built-in verify view | Checked in M2: works for logged-out users and redirects to the login screen with a success toast; no website page needed. |
| T3 | Unique-when-set fields | Partial unique indexes created by a migration; `''` normalized to `null` ([ADR-024](decisions/0024-unique-optional-fields-partial-indexes.md)). |
| T4 | GitHub 1,000-result search cap | No date slicing in v1; when the cap or `incomplete_results` is hit, skip hiding and warn. |
| T5 | Image size | Standalone output + bundled `cli.mjs` for migrate/seed/worker; REST rejected for migrations; optional CronJob mode for jobs ([ADR-023](decisions/0023-small-image-with-bundled-cli-scripts.md), supersedes ADR-010). |
| – | Spec layout | `spec/architecture/` split by topic, one file per ADR in `spec/decisions/`, `spec/README.md` index. |

## Proposed changes to the brief / bootstrap prompt

- **P1.** Brief, Posts: add "Imported posts without a public URL (e.g. uncategorized or future-dated) are skipped."
- **P2.** Brief, Users: state that OAuth sign-up requires a verified provider email (Q1).
- **P3.** Bootstrap prompt, Post sync: the public URL pattern is `https://payloadcms.com/posts/{category.slug}/{slug}` (verified), not `/posts/blog/{slug}` for every post.
- **P4.** Bootstrap prompt, worker and migrate Job: the image does not ship the Payload CLI; the worker runs `node cli.mjs worker` (equivalent to `payload jobs:run --cron "* * * * *" --handle-schedules --all-queues`) and the hook Job runs `node cli.mjs migrate && node cli.mjs seed` ([ADR-023](decisions/0023-small-image-with-bundled-cli-scripts.md)).
- **P5.** Brief, Moderation: mention moderation statuses are per version (an edit can be `rejected` while the published version stays live).
- **P6.** Brief, Listing pages: replace "Cards link directly to the external site. There are no detail pages for external entries." with "Resources, Plugins and Builds have detail pages with a prominent link to the external site; imported posts link to the original article." ([ADR-019](decisions/0019-detail-pages.md))
- **P7.** Brief, Authentication: replace "OAuth … is the only way to sign up" and "There is no public sign-up with email and password" with "Users can also sign up with email and password; the account is activated through an emailed link." Bootstrap prompt §5 "No public sign-up with a password" and the matching E2E test ("There is no public sign-up") change accordingly: test that registration works only after activation. ([ADR-020](decisions/0020-email-registration-with-activation.md))
- **P8.** Brief, Users: add "Signed-in users can connect and disconnect GitHub and Google on their account page." ([ADR-021](decisions/0021-connect-providers-while-signed-in.md))
- **P9.** Brief, Users and Roles: deleted users' content is anonymized in every status ([ADR-011](decisions/0011-account-deletion-anonymizes-content.md)).
- **P10.** Bootstrap prompt §3 rules 2 and 6, §4 M0, §5 and §6: replace `spec/architecture.md` with `spec/architecture/` and `spec/decisions.md` / `decisions.md` with `spec/decisions/` (one file per ADR).
