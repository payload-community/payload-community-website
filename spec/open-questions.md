# Open questions

Open items first, then resolved ones (kept for traceability). Proposed changes to `spec/BRIEF.md` / `spec/bootstrap-prompt.md` are at the end.

## Open

**Q17. Sign-up with an email that already has an account.** To avoid revealing which emails are registered, `/sign-up` always answers "Check your inbox".
*Default:* no email is sent to the existing account in v1. *Alternative:* send "You already have an account — sign in or reset your password" to that address (better UX, one more template).

**Q18. Unverified accounts cleanup.** Self-registered accounts that never activate stay in the database.
*Default:* keep them for now. *Alternative:* a daily job deletes unverified accounts older than 7 days.

**Q19. Bot protection on registration.** Rate limiting + email activation only.
*Default:* no CAPTCHA in v1. *Alternative:* Cloudflare Turnstile or hCaptcha on `/sign-up` (third-party script → consent/CSP implications).

**Q20. Garage public URL** — see the question asked in the 2026-10-10 review (serve files from Garage's own public web endpoint vs. under the portal domain).

### Technical (verify during implementation)

**T1. Admin create view without password fields.** Payload's create view for auth collections shows password fields. We plan to hide them and set a random password in `beforeValidate` (M2). If the admin UI still requires them, fallback: a small custom field component that pre-fills a generated password and hides the inputs.

**T2. Lingui SWC plugin compatibility.** `@lingui/swc-plugin` must match the SWC version bundled with Next.js. If 6.7.1 does not load with Next 16.3.3, fallback: pin the swc plugin version listed as compatible in Lingui's compatibility table. Verified in M4.

**T3. Unique sparse indexes in MongoDB.** `posts.url`, `plugins.fullName`, `post-media.originalUrl`, `users.githubId/googleId` must be unique only when set. Verify the mongoose adapter creates sparse/partial indexes for non-required unique fields; otherwise store `undefined` (not `null`) or add a migration with a partial index.

**T4. GitHub search cap.** Date-sliced queries are implemented only if `total_count > 1000`; today the topic has far fewer repositories.

**T5. Image size for the one-image design** (ADR-010). Expect ~600–900 MB; acceptable?

**T6. Built-in verify view.** Confirm that `/admin/users/verify/{token}` works for non-admin users and redirects to the login screen; otherwise add a small website `/verify-email` page calling `POST /api/users/verify/{token}`.

## Resolved (2026-10-10 review)

| # | Question | Resolution |
|---|---|---|
| Q1 | OAuth accounts without a verified email | Refuse sign-in until the email is verified at the provider (ADR-005). |
| Q2 | Linking providers with different emails | Same verified email links automatically; additionally users can connect providers from `/account` (idea I1 approved, ADR-021). |
| Q3 | Content of deleted users | Anonymize all content, in every status (ADR-011). |
| Q4 | Rejected edit of a published entry | Published version stays live; author can edit again; no author "discard changes". |
| Q5 | Unpublish while an edit is pending | Latest draft becomes the hidden document; documented for moderators. |
| Q6 | Moderator drafts of new entries | Shown in the queue as `pending`, without notifications. |
| Q7 | Plugin sync freshness with a pending edit | `payload.db.updateOne` on the published document (ADR-012). |
| Q8 | Manual plugin merge | Keep the user's name/description/homepage; update only sync-owned fields. |
| Q9 | Moderators editing imported plugins | No; admins only. |
| Q10 | Admin role removal | No automatic revocation. |
| Q11 | Imported post tags | Source category name. |
| Q12 | Detail pages | Detail pages for Resources, Plugins and Builds (ADR-019). |
| Q13 | Reset-password UX | Reuse Payload's admin reset/forgot views. |
| Q14 | Admins receive moderation emails | Yes, unless turned off. |
| Q15 | Privacy policy | Generated default page from the seed (ADR-022). |
| Q16 | Production email DNS | SPF/DKIM/DMARC listed in `docs/deployment.md` once the provider is chosen. |

## Proposed changes to the brief / bootstrap prompt

- **P1.** Brief, Posts: add "Imported posts without a public URL (e.g. uncategorized or future-dated) are skipped."
- **P2.** Brief, Users: state that OAuth sign-up requires a verified provider email (Q1).
- **P3.** Bootstrap prompt, Post sync: the public URL pattern is `https://payloadcms.com/posts/{category.slug}/{slug}` (verified), not `/posts/blog/{slug}` for every post.
- **P4.** Bootstrap prompt, worker: the exact command for 3.90.2 is `payload jobs:run --cron "* * * * *" --handle-schedules --all-queues`.
- **P5.** Brief, Moderation: mention moderation statuses are per version (an edit can be `rejected` while the published version stays live).
- **P6.** Brief, Listing pages: replace "Cards link directly to the external site. There are no detail pages for external entries." with "Resources, Plugins and Builds have detail pages with a prominent link to the external site; imported posts link to the original article." (ADR-019)
- **P7.** Brief, Authentication: replace "OAuth … is the only way to sign up" and "There is no public sign-up with email and password" with "Users can also sign up with email and password; the account is activated through an emailed link." Bootstrap prompt §5 "No public sign-up with a password" and the matching E2E test ("There is no public sign-up") change accordingly: test that registration works only after activation. (ADR-020)
- **P8.** Brief, Users: add "Signed-in users can connect and disconnect GitHub and Google on their account page." (ADR-021)
- **P9.** Brief, Users and Roles: deleted users' content is anonymized in every status (ADR-011).
