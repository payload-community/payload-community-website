# ADR-011: Account deletion anonymizes all content

- Status: Accepted
- Proposed: 2026-10-09
- Accepted: 2026-10-10
- Revised: 2026-10-10 (during the M0 review)

*Revised 2026-10-10 (Q3):* on user deletion, `createdBy` is cleared on **all** their Posts/Resources/Plugins/Builds/Post Media, in every moderation status; content is shown as "Former member". Pending entries stay in the moderation queue and can still be approved or rejected; author notifications are skipped for entries without an author. Old versions keep only the deleted user's ID.
