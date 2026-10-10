# ADR-020: Email registration with activation link (extends the brief)

- Status: Accepted
- Proposed: 2026-10-09
- Accepted: 2026-10-10

*Context.* The brief allows sign-up only through OAuth; reviewed 2026-10-10: email/password registration with an activation link is wanted on the website.

*Decision.* Payload's built-in `auth.verify`: anonymous `create` (registration form) → activation email → built-in verify view `/admin/users/verify/{token}`; unverified users cannot sign in. Custom code limited to: the guard that whitelists registration fields, a "resend activation" endpoint (not built into Payload 3.90.2), an `afterOperation` hook on `resetPassword` that marks the user verified (Payload does not), and the pre-hijacking protection in OAuth linking (an unverified password account claimed by OAuth gets a new random password).

*Consequences.* Bots can register (mitigated by rate limits and verification; CAPTCHA deferred, Q19). Email enumeration on sign-up is avoided with generic responses (Q17). Proposed brief change P7.
