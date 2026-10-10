# Authentication

Part of the [architecture](README.md). Section numbers are global across the architecture files, so references such as [§6.3](moderation.md#63-transitions) stay stable.

---

## 12. Authentication flow

Plugin: `payload-oauth2` 1.0.21, two instances ([ADR-001](../decisions/0001-oauth-plugin-payload-oauth2.md)).

| | GitHub | Google |
|---|---|---|
| `strategyName` | `github` | `google` |
| `subFieldName` | `githubId` | `googleId` |
| authorize | `GET /api/users/oauth/github` | `GET /api/users/oauth/google` |
| callback (register at provider) | `{NEXT_PUBLIC_SERVER_URL}/api/users/oauth/github/callback` | `{NEXT_PUBLIC_SERVER_URL}/api/users/oauth/google/callback` |
| provider authorize URL | `https://github.com/login/oauth/authorize` | `https://accounts.google.com/o/oauth2/v2/auth` |
| token endpoint | `https://github.com/login/oauth/access_token` | `https://oauth2.googleapis.com/token` |
| scopes | `read:user user:email` | `openid email profile` |
| user info | `GET https://api.github.com/user`, `GET https://api.github.com/user/emails` | `GET https://openidconnect.googleapis.com/v1/userinfo` |
| verified email | primary entry with `verified: true` from `/user/emails` | `email` when `email_verified === true` |
| PKCE | enabled (S256) | enabled (S256) |
| enabled when | `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` set | `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` set |

Local dev: `NEXT_PUBLIC_SERVER_URL=https://plc.ddev.site` (the DDEV add-on routes it to the Next.js server on port 3000) → callbacks e.g. `https://plc.ddev.site/api/users/oauth/github/callback`.

Implementation status: M2 shipped the admin side (login page with provider buttons, invitations, registration and activation through the REST API, resend endpoint). M4 added the website pages `/sign-in`, `/sign-up`, `/account` and the connect flow of [§12.3](#123-connect-another-provider-while-signed-in-approved-idea-i1) (`src/website/auth/`, `src/auth/connectIntent.ts`).

Sign-in methods (website and admin): GitHub, Google, email + password. Sign-up methods: GitHub, Google, and the website registration form (email + password with activation link). One account can have any combination of GitHub, Google and a password.

### 12.1 OAuth sign-in / sign-up
1. Sign-in buttons (website `/sign-in`, `/sign-up`, and admin `beforeLogin`) link to the authorize endpoint with `?state=<return path>` (`/admin` or a website path; validated against an allow-list of relative paths in `successRedirect`). Buttons render only for enabled providers.
2. Callback → plugin exchanges code (+ PKCE verifier) → our `getUserInfo(accessToken, req)` (`src/auth/oauth/index.ts`; profile fetching and `zod` parsing in `providers.ts`) fetches the profile, validates it, then calls the pure function `resolveOAuthAccount()`:
   - **connect intent** present ([§12.3](#123-connect-another-provider-while-signed-in-approved-idea-i1)) → link the provider to the signed-in user.
   - find user by provider ID → **existing** (return `{ [subField], avatarUrl, githubLogin? }` only — never overwrite email/name).
   - else, if no verified provider email → refuse sign-in ("Verify an email address with {provider} first"; `/sign-in?error=email_unverified`) ([ADR-005](../decisions/0005-oauth-requires-verified-email.md)).
   - else find user by email (case-insensitive) → **link**: set the provider ID on that user and return as existing. If that account is a self-registered, **not yet verified** password account, the provider has now proven ownership of the email: set `_verified: true`, clear the verification token, and **replace the password with a random one** — otherwise someone who pre-registered the victim's email would keep a working password (account pre-hijacking). The user can set a password later via "forgot password".
   - else → **new user** `{ email, name, avatarUrl, [subField], githubLogin?, _verified: true }`; sets `req.context.oauthSignIn = true`.
3. The plugin finds the user by provider ID, creates or updates it, runs `beforeLogin`/`afterLogin` hooks, creates a Payload session, sets the `payload-token` cookie and redirects (`successRedirect`). Failures → `/admin/login?error=<reason>` when the return path is under `/admin`, else `/sign-in?error=<reason>` (`reason`: `email_unverified`, `provider_conflict`, `provider_in_use` or `oauth`); the admin `beforeLogin` component shows the message.
4. `beforeLogin` hook (all strategies including local password): if `githubLogin ∈ ADMIN_GITHUB_LOGINS` or `email ∈ ADMIN_EMAILS` (account verified) and the user lacks `admin` → add it (`overrideAccess`). Roles are never removed automatically.

### 12.2 Email registration and password sign-in
1. `/sign-up` (website): name, email, password (+ confirmation), privacy-policy acknowledgement, OAuth buttons. Server action `signUp` validates the form with `zod` (`src/website/auth/schemas.ts`), then `payload.create({ collection: 'users', overrideAccess: false, data: { name, email, password } })` as an anonymous request (same rules as REST `POST /api/users`). A duplicate email (`ValidationError` on `email`) gets the same "Check your inbox" answer.
2. Payload sends the **activation email** (`auth.verify`, custom template); the page shows "Check your inbox". If the email already exists, the response is the same generic message (no account enumeration); an email to an existing account is not sent in v1 (Q17).
3. The link opens Payload's built-in verify view `/admin/users/verify/{token}`, which verifies the token on the server (`_verified: true`) and redirects to the login screen with "Email verified successfully" — confirmed for logged-out users (T6). (Least code, same choice as Q13; a website `/verify-email` page is a later option.) In `next dev` the view can render twice, and the second render shows "Unable to Verify" although the account is already verified.
4. Password sign-in: website `/sign-in` form → `POST /api/users/login` (built-in, from the browser; then full navigation to `?next=` or `/`); unverified users (HTTP 403) get "Please activate your account" with a **resend** button. Payload 3.90.2 has no built-in resend operation, so `POST /api/users/resend-activation` (`{ email }`, rate-limited, always the same generic response) regenerates `_verificationToken` and sends the activation email again. Admin uses the standard login form, with a "Create an account" link to `/sign-up`.
5. **Admin-created accounts** ([ADR-002](../decisions/0002-admin-created-accounts-invitation.md)): the admin create view hides the password inputs and pre-fills them with a throwaway value (`HidePasswordOnCreate` UI field; Payload's create view always requires a password — T1). `beforeOperation` replaces it with a random password and marks the user verified; `afterChange` queues `sendInvitation`, which creates a reset token with `forgotPassword({ disableEmail: true })`, extends it to 7 days with `db.updateOne` (the collection's 1-hour `forgotPassword.expiration` would otherwise win) and queues `sendEmail` with the link `/admin/reset/{token}`. Payload's `first-register` screen is blocked (first admins come from `ADMIN_*` or the dev seed).
6. "Forgot password" → built-in endpoint, reset at `/admin/reset/{token}`. Payload's `resetPassword` does **not** set `_verified` (checked in 3.90.2), so an `afterOperation` hook on `resetPassword` marks the user verified — the reset link proves mailbox access. This also covers the invitation flow and replaces any password set by someone who pre-registered the email.
7. Abuse protection: Payload 3.90.2 has **no built-in rate limiting** (only `maxLoginAttempts` / `lockTime` per account: 5 attempts, 10 minutes). Request rate limits for `POST /api/users`, `/login`, `/forgot-password`, `/resend-activation` and the OAuth endpoints are set at the ingress (M6, `docs/deployment.md`). Minimum password length 10 (checked in the `beforeOperation` hook on create, update and reset), max length per Payload default. CAPTCHA is not in scope for v1 (Q19).

### 12.3 Connect another provider while signed in (approved idea I1)
- `/account` → "Connected accounts": GitHub / Google rows (enabled or already connected providers) with **Connect** or **Disconnect**; one "Set or change password" link to Payload's account view `/admin/account`.
- **Connect**: a plain form POST to the route handler `/account/connect` (same-origin `Origin` check; the session cookie is `SameSite=Lax`, so cross-site POSTs arrive signed out) sets an HttpOnly, HMAC-signed (`PAYLOAD_SECRET`), 10-minute `plc_connect` cookie containing the user ID and provider, then redirects (303) to the provider's authorize endpoint with `state=/account/connected`. A route handler rather than a server action, because the client router cannot follow a server-action redirect through an API route to an external site. In `getUserInfo`, if `req.user` (session cookie) matches the intent cookie: if the provider ID belongs to **another** user → refuse (`/account?error=provider_in_use`); else set the provider ID (and `githubLogin`) on the current user regardless of the provider email. `/account/connected` (route handler, also the failure target for this return path) deletes the cookie and redirects to `/account?connected=1` or `/account?error=<reason>`. PKCE ensures the code was obtained by this browser.
- **Disconnect**: a server action removes the provider ID (and `githubLogin`). Always allowed, because every account has a verified email and can recover through "forgot password"; the UI warns when it is the last connected provider (whether a password was ever set is not tracked, so the hint points to "Forgot password?").
- Matching by verified email still links automatically on normal sign-in ([§12.1](#121-oauth-sign-in--sign-up)), so users with the same email on GitHub and Google end up with one account without doing anything.

### 12.4 Security notes
- OAuth users get a random unusable password; "forgot password" sends the link only to the account email, which is verified (provider or activation), so no takeover without mailbox access.
- Account pre-hijacking via an unverified registration is neutralized as described in [§12.1](#121-oauth-sign-in--sign-up).
- Login CSRF is mitigated by PKCE (the plugin does not verify `state`); connecting a provider additionally requires the signed intent cookie set by a POST.
- Rate limiting on `/api/users` (create), `/api/users/login`, `/forgot-password`, `/resend-activation`, OAuth endpoints — at the ingress, since Payload has none built in.
- Relationships to users (`createdBy`, `moderatedBy`) populate only `name`, `avatarUrl` and `githubLogin` (`defaultPopulate`), never email or sessions.
- Payload sessions (`useSessions`) store all sessions in an array on the user document; two logins of the same user at the same moment can drop one session (seen in parallel E2E tests). Harmless in practice (the user signs in again); E2E runs with one worker.
