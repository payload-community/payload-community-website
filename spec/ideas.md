# Ideas (not approved — do not implement without approval)

| # | Idea | Value | Effort | Risks |
|---|---|---|---|---|
| I1 | **Connect another provider** from the account page while signed in (link GitHub + Google with different emails). | Fixes Q2 cleanly. | M — custom authorize flow carrying the current session. | Account-linking security; must re-verify the session. |
| I2 | **RSS/Atom adapter** for more news sources (dev.to tag, community blogs). | More news without manual posting. | S–M — new adapter behind the existing interface (`rss-parser`). | Feed quality; image hotlinking rules. |
| I3 | **Plugin compatibility badge**: read `peerDependencies.payload` from the npm manifest and show "Payload 3.x / 2.x". | Helps users pick plugins. | S — extra field in the npm step. | Monorepos, missing peer deps. |
| I4 | **Weekly digest email** (new plugins, posts, builds) with opt-in. | Engagement. | M — scheduled job + template + preference. | Deliverability, unsubscribe compliance. |
| I5 | **Report content** button for signed-in users (flag → moderator queue). | Post-moderation safety net. | M. | Abuse of reports. |
| I6 | **Stars history / trending plugins** (store weekly snapshots). | "Trending" section on home. | M — snapshot collection + chart. | DB growth (small). |
| I7 | **Resend invitation** admin action, and an "invitation expired" hint. | Fewer support requests. | S. | – |
| I8 | **Moderation audit log** (who did what, when) as a read-only collection. | Accountability across moderators. | S–M. | – |
| I9 | **Duplicate detection on submit** (same URL / repo already listed). | Less moderation work. | S — `beforeValidate` lookup with a friendly error. | – |
| I10 | **Public author profile pages** `/u/{githubLogin}` listing a member's published entries. | Community recognition. | M. | Privacy (opt-in needed). |
| I11 | **Link checker job** marking resources/builds whose URL returns 404 for 7+ days. | Fresh listings. | M. | False positives (bot protection). |
| I12 | **Discord/Slack webhook** for new pending submissions. | Faster moderation. | S. | Secret management. |
| I13 | **OpenGraph image generation** (`next/og`) for listings and community posts without images. | Better shares. | S. | Edge runtime constraints (use Node runtime). |
| I14 | **Meilisearch/Atlas Search** if `like` queries get slow. | Better search relevance. | M–L. | New infrastructure. |
