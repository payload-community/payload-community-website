# ADR-001: OAuth plugin: `payload-oauth2`

- Status: Accepted
- Proposed: 2026-10-09
- Accepted: 2026-10-10

**Context.** GitHub + Google on both the website and `/admin`, linking both providers to one user by verified email, alongside Payload's local (password) strategy. Candidates checked on 2026-10-09:

| Package | Version / published | Weekly DL | Peer deps | Notes |
|---|---|---|---|---|
| `payload-oauth2` | 1.0.21 / 2026-05-12 | 12.1k | `payload ^3` | Adds a Payload auth strategy + `authorize`/`callback` endpoints to the users collection; zero runtime deps besides `jose`; works with the admin panel and the local strategy; supports PKCE and Payload sessions. One instance per provider. |
| `payload-authjs` | 0.10.2 / 2026-05-29 | 7.3k | `next-auth ^5.0.0-beta.25` | Requires next-auth **v5 beta** (still `5.0.0-beta.32`); Auth.js owns the session, password sign-in would need Auth.js Credentials (no Payload forgot-password flow). |
| `payload-auth` | 3.0.0 / 2026-08-05 | 7.5k | `better-auth`, `@better-auth/passkey`, `@tanstack/react-form`… | Replaces Payload auth with Better Auth: largest surface and migration cost. |

**Decision.** `payload-oauth2`, registered twice (`github`, `google`) with `subFieldName` `githubId` / `googleId`, PKCE enabled, `useEmailAsIdentity: false`.

**Consequences / custom code we still need** (small, unit-tested):
- `getUserInfo` per provider + a pure `resolveOAuthAccount()` that links by **verified** email only (the plugin's `useEmailAsIdentity` links by any email, so it stays off).
- `getUserInfo` returns only safe fields for existing users because the plugin updates the user with whatever it returns on every login.
- The plugin forwards but never verifies `state` → login CSRF is mitigated by PKCE (the code can only be redeemed with the verifier cookie set in the initiating browser). `state` is used only for the post-login return path, validated against relative paths.
- Admin `beforeLogin` component with the two buttons; website `/sign-in` page.
- Reversible: the plugin only adds a strategy, two endpoints and the sub fields.
