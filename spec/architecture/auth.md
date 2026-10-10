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

Local dev: `NEXT_PUBLIC_SERVER_URL=https://plc.ddev.site:3000` (or the exposed HTTPS port chosen in M1) → callbacks e.g. `https://plc.ddev.site:3000/api/users/oauth/github/callback`.

Sign-in methods (website and admin): GitHub, Google, email + password. Sign-up methods: GitHub, Google, and the website registration form (email + password with activation link). One account can have any combination of GitHub, Google and a password.

### 12.1 OAuth sign-in / sign-up
1. Sign-in buttons (website `/sign-in`, `/sign-up`, and admin `beforeLogin`) link to the authorize endpoint with `?state=<return path>` (`/admin` or a website path; validated against an allow-list of relative paths in `successRedirect`). Buttons render only for enabled providers.
2. Callback → plugin exchanges code (+ PKCE verifier) → our `getUserInfo(accessToken, req)` (`src/auth/oauth/{github,google}.ts`) fetches the profile, validates with `zod`, then calls the pure function `resolveOAuthAccount()`:
   - **connect intent** present ([§12.3](#123-connect-another-provider-while-signed-in-approved-idea-i1)) → link the provider to the signed-in user.
   - find user by provider ID → **existing** (return `{ [subField], avatarUrl, githubLogin? }` only — never overwrite email/name).
   - else, if no verified provider email → refuse sign-in ("Verify an email address with {provider} first"; `/sign-in?error=email_unverified`) ([ADR-005](../decisions/0005-oauth-requires-verified-email.md)).
   - else find user by email (case-insensitive) → **link**: set the provider ID on that user and return as existing. If that account is a self-registered, **not yet verified** password account, the provider has now proven ownership of the email: set `_verified: true`, clear the verification token, and **replace the password with a random one** — otherwise someone who pre-registered the victim's email would keep a working password (account pre-hijacking). The user can set a password later via "forgot password".
   - else → **new user** `{ email, name, avatarUrl, [subField], githubLogin?, _verified: true }`; sets `req.context.oauthSignIn = true`.
3. The plugin finds the user by provider ID, creates or updates it, runs `beforeLogin`/`afterLogin` hooks, creates a Payload session, sets the `payload-token` cookie and redirects (`successRedirect`). Failures → `/sign-in?error=oauth`.
4. `beforeLogin` hook (all strategies including local password): if `githubLogin ∈ ADMIN_GITHUB_LOGINS` or `email ∈ ADMIN_EMAILS` (account verified) and the user lacks `admin` → add it (`overrideAccess`). Roles are never removed automatically.

### 12.2 Email registration and password sign-in
1. `/sign-up` (website): name, email, password (+ confirmation), privacy-policy acknowledgement, OAuth buttons. Server action → `payload.create({ collection: 'users', overrideAccess: false, data: { name, email, password } })` as an anonymous request (same rules as REST `POST /api/users`).
2. Payload sends the **activation email** (`auth.verify`, custom template); the page shows "Check your inbox". If the email already exists, the response is the same generic message (no account enumeration); an email to an existing account is not sent in v1 (Q17).
3. The link opens Payload's built-in verify view `/admin/users/verify/{token}` → `POST /api/users/verify/{token}` → `_verified: true` → the view redirects to the login screen. (Least code, same choice as Q13; a website `/verify-email` page is a later option.)
4. Password sign-in: website `/sign-in` form → `POST /api/users/login` (built-in); unverified users get "Please activate your account" with a **resend** button. Payload 3.90.2 has no built-in resend operation, so `POST /api/users/resend-activation` (`{ email }`, rate-limited, always the same generic response) regenerates `_verificationToken` and sends the activation email again. Admin uses the standard login form, with a "Create an account" link to `/sign-up`.
5. "Forgot password" → built-in endpoint, reset at `/admin/reset/{token}`. Payload's `resetPassword` does **not** set `_verified` (checked in 3.90.2), so an `afterOperation` hook on `resetPassword` marks the user verified — the reset link proves mailbox access. This also covers the invitation flow and replaces any password set by someone who pre-registered the email.
6. Abuse protection: Payload rate limiting on `POST /api/users`, `/login`, `/forgot-password`; minimum password length 10 (custom `validate` on the password via `beforeValidate`), max length per Payload default. CAPTCHA is not in scope for v1 (Q19).

### 12.3 Connect another provider while signed in (approved idea I1)
- `/account` → "Connected accounts": GitHub / Google rows with **Connect** or **Disconnect**; "Set a password" / "Change password" links.
- **Connect**: a POST (server action, CSRF-protected by Next.js) sets an HttpOnly, signed (`PAYLOAD_SECRET`), 10-minute `plc_connect` cookie containing the user ID and provider, then redirects to the provider's authorize endpoint with `state=/account`. In `getUserInfo`, if `req.user` (session cookie) matches the intent cookie: if the provider ID belongs to **another** user → refuse (`/account?error=provider_in_use`); else set the provider ID (and `githubLogin`) on the current user regardless of the provider email. The cookie is cleared after use. PKCE ensures the code was obtained by this browser.
- **Disconnect**: removes the provider ID. Always allowed, because every account has a verified email and can recover through "forgot password"; the UI warns when it is the last OAuth provider and no password was set.
- Matching by verified email still links automatically on normal sign-in ([§12.1](#121-oauth-sign-in--sign-up)), so users with the same email on GitHub and Google end up with one account without doing anything.

### 12.4 Security notes
- OAuth users get a random unusable password; "forgot password" sends the link only to the account email, which is verified (provider or activation), so no takeover without mailbox access.
- Account pre-hijacking via an unverified registration is neutralized as described in [§12.1](#121-oauth-sign-in--sign-up).
- Login CSRF is mitigated by PKCE (the plugin does not verify `state`); connecting a provider additionally requires the signed intent cookie set by a POST.
- Rate limiting on `/api/users` (create), `/api/users/login`, `/forgot-password`, OAuth endpoints.
