# ADR-026: Moderation controls in the admin panel

- Status: Accepted
- Proposed: 2026-10-10
- Accepted: 2026-10-11
- Revised: 2026-10-11 (review of Q21: authors may unpublish their own entries, decision 5)

## Context

[§6](../architecture/moderation.md#6-moderation-state-machine) defines the transitions but leaves three behaviours of Payload's built-in edit controls open:

1. Payload shows **Publish changes** and **Unpublish** to every user with update access, including regular users. For them the enforcement hook turns every save into a draft, so the buttons would report "published" or "unpublished" while nothing public changed.
2. Payload's **Unpublish** control (and bulk unpublish) writes the main document with `_status: 'draft'`. Without special handling the latest status would stay `published` while the main document is hidden, which breaks the invariant `_status == published ⇔ moderation.status == published`.
3. T8 (a moderator clicks **Publish changes**) sends no email. If a moderator publishes someone else's pending entry from the edit view, it is in effect an approval, but the author would not be told.

## Decision

1. Regular users see only **Save Draft**: the collection's `PublishButton` and `UnpublishButton` slots render nothing for them. Moderators keep **Publish changes**. Payload's **Unpublish** is hidden for everyone; unpublishing is a moderation action in the sidebar and on the dashboard.
5. Authors may **unpublish their own entries** (review decision on Q21): the *Moderation* sidebar field shows them only *Unpublish* on their published entries, and the moderation endpoint accepts `unpublish` from the entry's author (`createdBy`). The status becomes `unpublished` with the author as `moderatedBy`; no email is sent. Authors still cannot re-publish: saving the entry resubmits it for review (T4).
2. A moderator's main-document write with `_status: 'draft'` and without `draft: true` (REST or Local API) is treated as the `unpublish` moderation action (`beforeOperation` sets `context.moderationAction`).
3. When a moderator publishes an entry whose latest status was not `published` and which belongs to someone else, the author gets the `entryApproved` email (same as T5). `moderatedBy` and `moderatedAt` are set.
4. Notification emails are queued in the shared `afterChange` hook, with one `sendEmail` job per recipient, inside the request transaction (a failed save queues nothing). There is no separate fan-out job.

## Consequences

- No misleading "published" toasts for regular users, and the invariant holds for every write path.
- Authors are told whenever their entry goes live through a moderator, whichever button was used.
- Queueing per recipient in the hook keeps retries per email (a retry never re-sends to other recipients). The cost is one user query per submission, which is fine for the expected number of moderators.
- Authors can take their content down without asking a moderator; moderators can still re-publish it, so the docs ask them to do that only on the author's request.
- Reversible: removing the two button slots restores Payload's defaults.
