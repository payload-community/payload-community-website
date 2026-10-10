# ADR-004: First admin and first-register screen

- Status: Accepted
- Proposed: 2026-10-09
- Accepted: 2026-10-10

Payload's "create first user" screen creates an already-verified user when the users collection is empty, bypassing email activation. We block `first-register` ([ADR-002](0002-admin-created-accounts-invitation.md)). First admins: OAuth sign-in with a GitHub login in `ADMIN_GITHUB_LOGINS`, or a verified account (OAuth or activated password account) whose email is in `ADMIN_EMAILS`; locally also `pnpm seed:dev`. Admin roles are added on every sign-in and never removed automatically.
