# Open questions

Each item has the **default** we implement unless you decide otherwise. Proposed changes to `spec/BRIEF.md` / `spec/bootstrap-prompt.md` are at the end.

## Product

**Q1. OAuth accounts without a verified email.** GitHub users without a verified primary email, or Google accounts with `email_verified: false`, cannot be linked safely, and the users collection needs a unique email.
*Default:* refuse sign-in with a message asking to verify the email at the provider (ADR-005). *Alternative:* create the account with no email (requires making email optional → custom auth handling).

**Q2. Linking providers with different emails.** Linking is only by matching verified email. A user whose GitHub and Google emails differ gets two accounts.
*Default:* accept for now. *Idea:* "Connect GitHub/Google" buttons on the account page while signed in (see `ideas.md`).

**Q3. Content of deleted users.**
*Default:* anonymize — clear `createdBy` on published entries (shown as "Former member"), delete their pending and rejected entries. *Alternative A:* delete everything they created. *Alternative B:* anonymize everything, including pending entries.

**Q4. Rejection of an edit to a published entry.** The published version stays live and the latest draft is `rejected`; the author can edit again (back to `pending`).
*Default:* as described. Should the author also be able to "discard changes" (restore the published version as latest)? Payload's version restore covers this for moderators; not exposed to authors by default.

**Q5. Unpublish while an edit is pending.** Unpublishing makes the latest draft the hidden main document (pending changes leave the queue).
*Default:* accept and document for moderators.

**Q6. Moderator drafts.** A moderator saving a *draft* of a new entry: should it appear in the pending queue?
*Default:* yes, as `pending`, without notifications. Alternatively we add a `draft` moderation status (more states).

**Q7. Sync data freshness for plugins with a pending edit.** We refresh the published document directly via the DB adapter (ADR-012). OK to have this single low-level write?

**Q8. Manual plugin merge.** When the search finds a repo that exists as a manual plugin, we update only sync-owned fields (stars, topics, dates, npm data) and keep the user's name/description/homepage. Should GitHub's description override the user's?
*Default:* keep the user's values.

**Q9. Imported plugin edits by moderators.** Imported plugins are read-only for everyone except admins (moderators can unpublish/delete). Should moderators be able to override descriptions (would be overwritten by the next sync anyway)?
*Default:* no.

**Q10. Admin role removal.** Users in `ADMIN_GITHUB_LOGINS`/`ADMIN_EMAILS` get `admin` on every sign-in; removing them from the list does not revoke the role.
*Default:* no automatic revocation (admins remove roles in the panel).

**Q11. Posts tags for imported posts.** We map the source category name (`Blog`, `Releases`, `Guides`) to `tags`.
*Default:* yes. Confirm this is the desired tag vocabulary for News filters.

**Q12. Builds detail pages.** Builds have a unique slug but no detail pages (brief: cards link externally). Slug is used as an anchor only.

**Q13. Reset-password UX.** Invitation and forgot-password links open Payload's admin reset page (`/admin/reset/{token}`), then the user lands in `/admin`.
*Default:* reuse the admin pages (least code). *Alternative:* website `/reset-password` page with the template's styling (small form calling the REST endpoint).

**Q14. Moderation notification recipients.** Admins without the moderator role also receive submission emails (brief: "all Moderators and Admins"), unless they turn it off.

**Q15. Privacy policy content.** The seed creates a placeholder privacy policy describing the data we collect (provider profile, email, GA after consent). Needs a legal review and the operator's identity/contact.

**Q16. Production email.** SPF/DKIM/DMARC records are listed in `docs/deployment.md` once the provider and the sending domain are chosen.

## Technical

**T1. Admin create view without password fields.** Payload's create view for auth collections shows password fields. We plan to hide them and set a random password in `beforeValidate` (M2). If the admin UI still requires them, fallback: a small custom field component that pre-fills a generated password and hides the inputs. Verified in M2.

**T2. Lingui SWC plugin compatibility.** `@lingui/swc-plugin` must match the SWC version bundled with Next.js. If 6.7.1 does not load with Next 16.3.3, fallback: pin the swc plugin version listed as compatible in Lingui's compatibility table. Verified in M4.

**T3. Unique sparse indexes in MongoDB.** `posts.url`, `plugins.fullName`, `post-media.originalUrl`, `users.githubId/googleId` must be unique only when set. Verify the mongoose adapter creates sparse/partial indexes for non-required unique fields; otherwise store `undefined` (not `null`) or add a migration with a partial index.

**T4. GitHub search cap.** Date-sliced queries are implemented only if `total_count > 1000`; today the topic has far fewer repositories.

**T5. Image size for the one-image design** (ADR-010). Expect ~600–900 MB; acceptable?

## Proposed changes to the brief / bootstrap prompt

- **P1.** Brief, Posts: add "Imported posts without a public URL (e.g. uncategorized or future-dated) are skipped."
- **P2.** Brief, Users: state that OAuth sign-up requires a verified provider email (Q1).
- **P3.** Bootstrap prompt, Post sync: the public URL pattern is `https://payloadcms.com/posts/{category.slug}/{slug}` (verified), not `/posts/blog/{slug}` for every post.
- **P4.** Bootstrap prompt, worker: the exact command for 3.90.2 is `payload jobs:run --cron "* * * * *" --handle-schedules --all-queues`.
- **P5.** Brief, Moderation: mention moderation statuses are per version (an edit can be `rejected` while the published version stays live).
