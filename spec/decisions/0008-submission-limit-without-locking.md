# ADR-008: Submission limit: hook-based, no locking

- Status: Accepted
- Proposed: 2026-10-09
- Accepted: 2026-10-10

One shared `beforeChange` hook counts the user's latest-version `pending` entries across four collections (`count` with `draft: true`). Concurrent saves may let a 4th entry through; accepted instead of distributed locks or transactions across collections. `MAX_PENDING_SUBMISSIONS = 3` constant.
