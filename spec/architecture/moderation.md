# Moderation

Part of the [architecture](README.md). Section numbers are global across the architecture files, so references such as [§6.3](#63-transitions) stay stable.

---

## 6. Moderation state machine

### 6.1 Building blocks
- **Payload drafts** carry the "old version stays live" requirement: the main document is only written when a save is *not* a draft save; a draft save only creates a new version (`latest: true`). Public reads (`draft: false`) return the main (published) document.
- **`moderation.status` lives on each version**. The latest version's status is the workflow state; the main document's status is the public state. Invariant: main document `_status == published` ⇔ main document `moderation.status == published`.
- Queues and counts use `draft: true` queries (latest version) — `find`/`count` with `draft: true`.

### 6.2 Enforcement hooks (shared factory `moderatedCollection()`)
1. **`beforeOperation` (create/update)** — if the user is a regular user and the request is not a system request: force `args.draft = true` and `args.data._status = 'draft'`. This makes publishing impossible for regular users through admin, REST and GraphQL (Payload only publishes when `draft` is false or `_status == 'published'`).
2. **`beforeChange`** — compute the next `moderation.status` (table below), set `origin`, `createdBy`, `submittedAt`, apply the **submission limit** ([§7](#7-submission-limit)); reject `moderation.*` changes not coming from a moderation action.
3. **`afterChange`** — detect transitions (`previousDoc.moderation.status` → `doc.moderation.status`) and queue notification jobs ([§10](operations.md#10-email)); revalidate Next.js cache tags when the main document changed.

### 6.3 Transitions

| # | Actor | Action | From (latest) | To | Payload write | Notification |
|---|---|---|---|---|---|---|
| T1 | Regular | create | – | `pending` | draft (main doc created as draft) | moderators |
| T2 | Regular | edit | `pending` | `pending` | draft version | – |
| T3 | Regular | edit | `published` | `pending` | draft version; published main doc stays live | moderators |
| T4 | Regular | edit | `rejected` / `unpublished` | `pending` | draft version | moderators |
| T5 | Mod/Admin | approve / re-publish | `pending` / `rejected` / `unpublished` | `published` | `update({ draft: false, _status: 'published' })` publishes the latest draft | author "approved" (if not own) |
| T6 | Mod/Admin | reject (reason optional) | `pending` | `rejected` | `update({ draft: true })` → published main doc (if any) stays live | author "rejected" (if not own) |
| T7 | Mod/Admin | unpublish | `published` (or latest draft over a published doc) | `unpublished` | `update({ draft: false, _status: 'draft' })` → main doc hidden | – |
| T8 | Mod/Admin | create / edit + Publish | any | `published` | normal publish | – |
| T9 | Mod/Admin | edit + Save draft | any | unchanged (new: `pending`) | draft | – |
| T10 | Owner / Mod / Admin | delete | any | – | delete document and versions | – |
| T11 | System (sync) | create / update | – / any | create: `published`; update: unchanged | [§11.3](sync.md#113-sync-writes-and-drafts) | – |

Notes:
- Moderators change status only through **moderation actions** (T5–T7), available on the dashboard and in the edit-view sidebar. The status select itself is read-only in the UI.
- Approving publishes the **latest** draft (what the moderator reviewed via the versions diff view).
- A rejected edit of a published entry keeps the published version live; the author sees `rejected` + reason in their list (admin lists show latest versions).
- T7 on an entry with a newer pending draft: the draft becomes the hidden main document with status `unpublished` (pending changes are dropped from the queue). Documented for moderators.
- **Simpler model considered**: status field only, no drafts. Rejected because it cannot keep the old version live while an edit waits ([ADR-003](../decisions/0003-moderation-drafts-and-status-group.md)).

---

## 7. Submission limit

- `MAX_PENDING_SUBMISSIONS = 3` in `src/moderation/config.ts`.
- In the shared `beforeChange` hook, when a **regular** user's save moves an entry **into** `pending` from anything else (T1, T3, T4): sum `payload.count({ collection, draft: true, where: { createdBy: { equals: user.id }, 'moderation.status': { equals: 'pending' } } })` over the four collections (indexed fields). If the sum ≥ 3 → `throw new APIError(msg, 429, { limit, pending }, true)` (public message, shown in admin toast and returned by REST).
- T2 (already pending) is not counted. Moderators/admins exempt.
- A race between two concurrent saves may admit a 4th entry — accepted ([ADR-008](../decisions/0008-submission-limit-without-locking.md)).
- Metric `plc.moderation.submissions_refused` incremented.
- `PendingSlotsBanner` admin component (`beforeDocumentControls` / list `beforeList` for the four collections) shows "You can submit N more entries" for regular users.
- Message text (Payload admin i18n key `plc:pendingLimitReached`): "You have 3 submissions waiting for review. You can submit more once a moderator approves or rejects one of them, or after you delete one."

---

## 8. Moderation dashboard and actions

- **Endpoint**: `POST /api/moderation/:collection/:id/:action` (root Payload endpoint), `action ∈ approve | reject | unpublish | republish`, body `{ reason? }`. Access: moderator/admin (`req.user`), CSRF via Payload's cookie + `Origin` check (`csrf` config). Performs the Local API call from [§6.3](#63-transitions) with `req` (user context) and `context.moderationAction = action`.
- **Admin view** `/admin/moderation` (`admin.components.views.moderation`, server component, `@payloadcms/ui` `Gutter`, `Button`, `Pill`, tables). Tabs (`?tab=pending|rejected|unpublished`, search params): one merged list of the four collections via `payload.find({ draft: true, where: status })` per collection, merged and sorted by `moderation.submittedAt` (pending oldest first) — paged 50 per tab. Columns: type, title, author, submitted, link to edit view and versions (diff) view; actions approve / reject (small client form with reason) / re-publish.
- Nav link via `admin.components.afterNavLinks`, rendered only for moderators/admins; the view itself checks the role server-side and returns 404/redirect for others.
- **Dashboard widget** (`beforeDashboard`): pending count per type + link to the dashboard (moderators/admins only).
