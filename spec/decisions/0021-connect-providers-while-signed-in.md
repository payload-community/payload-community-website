# ADR-021: Connect providers while signed in (approved idea I1)

- Status: Accepted
- Proposed: 2026-10-09
- Accepted: 2026-10-10

*Decision.* "Connected accounts" on `/account`: connect GitHub/Google to the current account regardless of the provider email (signed 10-minute intent cookie set by a POST + session + PKCE), refuse when the provider identity already belongs to another user, and allow disconnecting (recovery is always possible through the verified email). Automatic linking by matching verified email on sign-in stays (Q2).

*Consequences.* Small extension of `resolveOAuthAccount()` plus a server action and the account UI; covered by unit tests of the linking logic.
