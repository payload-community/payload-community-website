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
3. **`afterChange`** — detect transitions (`previousDoc.moderation.status` → `doc.moderation.status`) and queue notification jobs ([§10](operations.md#10-email)); `revalidateEntry` refreshes the detail page, `/` and the section sitemap tag when the entry is or was published (`afterDelete` likewise; guarded outside Next.js, [ADR-029](../decisions/0029-website-page-caching-and-revalidation.md)).
4. **`afterRead`** — `populateAuthor` fills the virtual `populatedAuthor` (public name and avatar of `createdBy`).

The factory also sets `admin.preview` (draft preview through `/next/preview`; none for imported posts).

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
| T7a | Author (own entry) | unpublish | same as T7 | `unpublished` | same as T7; `moderatedBy` = the author | – |
| T8 | Mod/Admin | create / edit + Publish | any | `published` | normal publish | – |
| T9 | Mod/Admin | edit + Save draft | any | unchanged (new: `pending`) | draft | – |
| T10 | Owner / Mod / Admin | delete | any | – | delete document and versions | – |
| T11 | System (sync) | create / update | – / any | create: `published`; update: unchanged | [§11.3](sync.md#113-sync-writes-and-drafts) | – |

Notes:
- Moderators change status only through **moderation actions** (T5–T7), available on the dashboard and in the edit-view sidebar. The status select itself is read-only in the UI.
- Authors can **unpublish their own entries** (T7a, [ADR-026](../decisions/0026-moderation-admin-controls.md)) from the edit-view sidebar; it is the only moderation action open to them. To publish the entry again they save it, which resubmits it for review (T4). Moderators see it in the *Unpublished* tab (the entry's `moderatedBy` is the author) and can re-publish it.
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

- **Endpoint**: `POST /api/moderation/:collection/:id/:action` (root Payload endpoint), `action ∈ approve | reject | unpublish | republish`, body `{ reason? }`. Access: moderator/admin for every action; regular users only `unpublish` on entries they created (`createdBy`), otherwise 403. CSRF via Payload's cookie + `Origin` check (`csrf` config). Performs the Local API call from [§6.3](#63-transitions) with `req` (user context) and `context.moderationAction = action`.
- **Admin view** `/admin/moderation` (`admin.components.views.moderation`, server component, `@payloadcms/ui` `Gutter`, `Button`, `Pill`, tables). Tabs (`?tab=pending|rejected|unpublished`, search params): one merged list of the four collections via `payload.find({ draft: true, where: status })` per collection, merged and sorted by `moderation.submittedAt` (pending oldest first) — paged 50 per tab. Columns: type, title, author, submitted, link to edit view and versions (diff) view; actions approve / reject (small client form with reason) / re-publish.
- Nav link via `admin.components.afterNavLinks`, rendered only for moderators/admins; the view itself checks the role server-side and returns 404/redirect for others.
- **Dashboard widget** (`beforeDashboard`): pending count per type + link to the dashboard (moderators/admins only).

---

## Implementation (M3)

| Part | Code |
|---|---|
| Constants (`MAX_PENDING_SUBMISSIONS`, statuses, actions, allowed source statuses, portal paths) | `src/moderation/config.ts` |
| `beforeOperation` (`enforceDrafts`), `beforeChange` (`applyModerationState`), `afterChange` (`notifyTransitions`) | `src/moderation/workflow.ts`, wired in `src/moderation/collection.ts` |
| Submission limit | `src/moderation/limit.ts` (`countPendingSubmissions`: `find({ draft: true, limit: 1 })` per collection — `count` has no `draft` option in 3.90.2) |
| Recipients and email jobs | `src/moderation/notifications.ts` |
| Endpoint | `src/moderation/endpoint.ts` (zod-validated params and body; 401 anonymous, 403 non-moderator (except an author's `unpublish`), 404 unknown entry, 409 action not allowed from the current status) |
| Queue queries | `src/moderation/queue.ts` |
| Admin components | `src/moderation/components/` (`ModerationView`, `ModerationNavLink`, `ModerationWidget`, `ModerationActions`, `ActionButtons`, `PendingSlotsBanner` / `PendingSlotsNotice`, `ModeratedButtons`) |

Refinements of the sections above ([ADR-026](../decisions/0026-moderation-admin-controls.md)):

- Regular users see only **Save Draft**; Payload's *Publish* and *Unpublish* buttons are not rendered for them. Payload's *Unpublish* is hidden for moderators too, and a moderator's main-document write with `_status: 'draft'` (REST/bulk unpublish) is treated as the `unpublish` action.
- Authors get our own *Unpublish* button in the *Moderation* sidebar field on their published entries (T7a). `enforceDrafts` lets the main-document write through only when the endpoint set `context.moderationAction = 'unpublish'` (REST clients cannot set the context); `applyModerationState` checks that the user is the author.
- `approve` is accepted from `pending`, `rejected` and `unpublished` (same as `republish`); the UI shows *Approve* for pending entries and *Re-publish* for the others.
- T8 on someone else's entry whose latest status was not `published` sets `moderatedBy`/`moderatedAt` and sends `entryApproved`.
- Values sent for `moderation.*` by users are ignored rather than rejected: field access is `create/update: noOne`, and the `beforeChange` hook recomputes the group from the latest version.
- On system creates, the status is `published` when `_status` is `published`, otherwise the given status (default `pending`); system updates keep the status.
- A resubmission (T3/T4) clears `rejectionReason` and sets a new `submittedAt`; `moderatedBy`/`moderatedAt` keep the last decision.
- The 429 message is built from the `plc` translation catalog directly: on REST requests `req.t` only has Payload's API translations.
- Deferred: the `plc.moderation.submissions_refused` metric (M6, OpenTelemetry; a structured log line is written now) and cache revalidation in `afterChange` (done in M4, ADR-029).
