# ADR-002: Users: admin-created accounts get an invitation via `forgotPassword`

- Status: Accepted
- Proposed: 2026-10-09
- Accepted: 2026-10-10
- Revised: 2026-10-10 (during the M0 review)

*Revised 2026-10-10:* public email registration was added ([ADR-020](0020-email-registration-with-activation.md)); this ADR now covers admin-created accounts only.

- OAuth creates users via the Local API flagged with `req.context.oauthSignIn`; anonymous visitors can only register ([ADR-020](0020-email-registration-with-activation.md)).
- A `beforeOperation` guard on `create` restricts anonymous requests to `name`/`email`/`password` and rejects `/api/users/first-register` ([ADR-004](0004-first-admin-and-first-register.md)).
- Admin-created users: random password set server-side; `afterChange` (create, no provider IDs) queues `sendInvitation`, which calls `payload.forgotPassword({ disableEmail: true })` for the token, extends the token expiry to 7 days via the DB adapter, and sends our "set your password" email linking to Payload's built-in `/admin/reset/{token}` view.
- Regular forgot-password: built-in endpoint + customized `generateEmailHTML/Subject`; expiry 1 h.
- Reset/forgot pages: Payload admin views are reused (no custom website reset page) — least code; the website links to `/admin/forgot`.
