# Moderation guide

For moderators and admins of the Payload CMS Community Portal. Everything happens in the admin panel at `/admin`.

## How pre-moderation works

Community members add and edit **posts, resources, plugins and builds**. Nothing they submit is public until a moderator approves it.

- A new entry, or a change to an existing entry, is saved as a **draft** with the status **Pending**.
- When an already published entry is edited, the **published version stays live** until you approve the change.
- Each member can have at most **3 entries waiting for review** across all four types. They can submit more once you approve or reject one of them, or after they delete one. Moderators and admins have no limit.
- Members only see a **Save Draft** button. Saving submits the entry for review.

Statuses (shown in the sidebar of each entry, under *Moderation*):

| Status | Meaning |
|---|---|
| Pending | Waiting for review. |
| Published | Approved and visible on the portal. |
| Rejected | Not approved. If an older version was published, that version stays live. |
| Unpublished | Hidden from the portal by a moderator. |

The status belongs to the **latest version**. For example, a published resource whose edit you rejected shows *Rejected* in the lists, but its published version is still on the portal.

## The moderation queue

Open **Moderation** in the navigation (the badge shows how many entries are pending), or use the *Waiting for review* box on the dashboard.

The queue has three tabs:

- **Pending**: entries waiting for review, oldest first.
- **Rejected**: rejected entries with the reason you gave, most recent first.
- **Unpublished**: entries you hid from the portal.

Each row links to the entry (**Edit**) and to its **Versions**. Use *Versions* to compare an edit with the published version before approving it.

## Actions

| Action | Available when | Result | Email |
|---|---|---|---|
| **Approve** | Pending | Publishes the latest version. | Author: "Your entry is published" |
| **Reject** | Pending | Marks the latest version rejected; an older published version stays live. Add an optional reason. | Author: "Your entry was not approved", with the reason |
| **Re-publish** | Rejected, Unpublished | Publishes the latest version again. | Author: "Your entry is published" |
| **Unpublish** | Published (also while an edit is pending) | Hides the entry from the portal. | None |

The actions are on the queue and in the **sidebar of each entry** (under *Moderation*). In the entry view, save or discard your own changes first; the buttons are disabled while the form has unsaved changes.

Notes:

- **Approve publishes exactly what you reviewed**: the latest version. If the entry is missing a required field, approval fails with a validation message. Edit the entry, or reject it with a reason.
- **Unpublishing an entry with a pending edit** hides the entry and makes the pending edit the hidden version, with status *Unpublished*. The edit leaves the pending queue. Re-publish it later to publish that edit.
- You can also edit an entry yourself and click **Publish changes**. If the entry belongs to someone else and was not published yet, this counts as an approval and the author gets the "published" email.
- **Save Draft** keeps the current status. A new entry you save as a draft appears in the pending queue (without emails).
- No email is sent when you act on your own entries.
- **Imported entries** (synchronized posts and plugins) can only be edited by admins. Moderators can still unpublish them.
- **Deleting** an entry removes it and all its versions. Authors can delete their own entries.

## Emails

Emails are sent through the jobs queue within about a minute.

- **New submission**: sent to every moderator and admin (except the author) when a member submits a new entry or an edit. It contains the type, title, author, date and links to the entry and the queue.
- **Published / Not approved**: sent to the author after you approve, re-publish or reject their entry.

Turn emails off on your account page (**Account → Notifications**): *Moderation* controls the new-submission emails, *Own entries* the emails about your own entries.

## For developers

The workflow is specified in [`spec/architecture/moderation.md`](../spec/architecture/moderation.md). The code lives in `src/moderation/`. Moderation actions are also available over REST: `POST /api/moderation/{collection}/{id}/{approve|reject|unpublish|republish}` with an optional `{ "reason": "…" }` body (moderators and admins only).
