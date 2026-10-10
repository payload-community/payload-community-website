# ADR-005: OAuth sign-up requires a verified email

- Status: Accepted
- Proposed: 2026-10-09
- Accepted: 2026-10-10

The users collection keeps the local strategy, so `email` is required and unique. If a provider reports no verified email (GitHub: no verified primary email; Google: `email_verified: false`), sign-in is refused with an explanation instead of creating an account with an unverified or placeholder email. Avoids takeovers via unverified emails and keeps the schema simple. Accepted (Q1).
