# Roles and access control

Part of the [architecture](README.md). Section numbers are global across the architecture files, so references such as [§6.3](moderation.md#63-transitions) stay stable.

---

## 3. Roles and helpers

`users.roles`: `select`, `hasMany`, options `admin`, `moderator`; empty = regular user. `saveToJWT: true`.

Access helpers in `src/access/`: `isAdmin(user)`, `isModerator(user)` (moderator **or** admin), `isSignedIn(user)`, `isOwner(field = 'createdBy')` (returns a `where` constraint), `publishedOnly` (returns `{ _status: { equals: 'published' } }`), `syncFieldAccess` (admin only for create/update).

A request is a **system** request when it runs from a job, seed or migration (`req.context.system === true`, always with `overrideAccess: true`).

---

## 5. Access-control matrix (content collections)

Legend: ✔ allowed, ✘ denied, **own** = `createdBy == user.id`, **pub** = `_status == published` (plus `hidden != true` for plugins).

| Collection / operation | Anonymous | Regular user | Moderator | Admin | System (jobs/seed) |
|---|---|---|---|---|---|
| Posts/Resources/Plugins/Builds — read | pub | pub ∪ own (all versions/statuses) | all | all | all |
| — readVersions | ✘ | own | all | all | all |
| — create | ✘ | ✔ (forced draft → `pending`) | ✔ (published) | ✔ (published) | ✔ |
| — update | ✘ | own, not imported (forced draft → `pending`) | all except imported content fields | all | ✔ |
| — publish (`_status: published`) | ✘ | ✘ (rewritten to draft) | ✔ | ✔ | ✔ |
| — change `moderation.*` | ✘ | ✘ | via actions | via actions | ✔ |
| — delete | ✘ | own | all | all | ✔ |
| Sync-owned fields | – | read-only | read-only | ✔ | ✔ |
| Post Media | read | read, create, own update/delete | all | all | ✔ |
| Media | read | read | all | all | ✔ |
| Pages | pub | pub | pub; update `community` | all | ✔ |
| Header/Footer globals | read | read | read | update | ✔ |
| Redirects | read (plugin default) | ✘ write | ✘ write | all | ✔ |
| Sources | read | read | read | all | ✔ |
| Users | create = registration only | self | read (no emails), self update | all | ✔ |
| Jobs / manual sync trigger | ✘ | ✘ | ✘ | ✔ | `CRON_SECRET` |

Admin-panel visibility (`admin.hidden`): Users, Sources, Jobs, Redirects, Header, Footer, Pages hidden for regular users; Users/Sources/Jobs/Redirects/Header/Footer hidden for moderators. Regular users see Posts, Resources, Plugins, Builds, Post Media, and their account.

Website server code: public pages use the Local API with `draft: false`, `overrideAccess: false` and **no user** (anonymous access rules) — the website never shows drafts outside live preview.
