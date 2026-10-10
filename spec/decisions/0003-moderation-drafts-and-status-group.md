# ADR-003: Moderation = Payload drafts + `moderation` group

- Status: Accepted
- Proposed: 2026-10-09
- Accepted: 2026-10-10

- `versions.drafts` keeps the published main document live while a newer draft waits; `moderation.status` on each version is the workflow state (see architecture [§6](../architecture/moderation.md#6-moderation-state-machine)).
- Regular users are forced into draft saves in a `beforeOperation` hook (sets `args.draft = true`, `data._status = 'draft'`) — verified in `payload/dist/collections/operations/utilities/update.js` (3.90.2) that the main document is only written when not saving a draft.
- Moderation actions (approve/reject/unpublish/re-publish) go through one endpoint that performs Local API updates with the moderator's `req`.
- Rejected alternative: a status field without drafts — cannot keep the approved version visible during review.
- Rejected alternative: a separate "submissions" collection holding pending changes — more custom code, loses Payload's version diff view.
