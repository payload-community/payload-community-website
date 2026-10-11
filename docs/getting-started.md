# Getting started

Local development runs entirely inside the DDEV `web` container. The project root inside the container is `/app`.

## Prerequisites

- [DDEV](https://ddev.com/) with the project's add-ons (MongoDB, Garage S3, Mailpit, Playwright) already configured in `.ddev/`.
- Node.js 24 and pnpm are provided by the container (corepack). Use **pnpm only**.

## First-time setup

On the host:

```bash
ddev start
ddev ssh            # or attach your editor to the web container
```

Inside the container:

```bash
cp .env.example .env   # only if .env does not exist yet; then fill in the secrets
pnpm install
npx skills experimental_install   # optional: AI agent skills listed in skills-lock.json
pnpm migrate           # database indexes (safe to run again)
pnpm seed:dev          # base pages and navigation, sample data and accounts
pnpm dev
```

Open:

| What | URL |
| --- | --- |
| Website | https://plc.ddev.site |
| Admin panel | https://plc.ddev.site/admin |
| Uploaded files (Garage web endpoint) | https://garage.plc.ddev.site:3902/media/... |
| Mailpit (outgoing email) | https://plc.ddev.site:8026 |

The Next.js dev server listens on port 3000 inside the container. The DDEV add-on config `.ddev/config.generic-app.yaml` exposes it through the DDEV router as `https://plc.ddev.site`. DDEV configuration is kept locally and is not committed (`/.ddev` is gitignored). After changing files in `.ddev/`, run `ddev restart` on the host.

Inside the container the server is also reachable at `http://localhost:3000`.

## Environment variables

All variables are documented in [`.env.example`](../.env.example). The most important ones for local development:

| Variable | Local value / notes |
| --- | --- |
| `DATABASE_URI` | `mongodb://db:db@mongo:27017/plc?authSource=admin` |
| `PAYLOAD_SECRET`, `CRON_SECRET`, `PREVIEW_SECRET` | Random strings, e.g. `openssl rand -hex 32` |
| `NEXT_PUBLIC_SERVER_URL` | `https://plc.ddev.site` (no trailing slash). Also the base of the OAuth callback URLs. |
| `S3_ENDPOINT` | `http://garage:3900` (S3 API, inside the DDEV network) |
| `S3_REGION` / `S3_BUCKET` | `garage` / `garage` |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Garage key created by the DDEV add-on |
| `S3_FORCE_PATH_STYLE` | `true` |
| `S3_PUBLIC_URL` | `https://garage.plc.ddev.site:3902` (Garage web endpoint, serves files publicly) |
| `S3_KEY_PREFIX` | Empty locally. Tests set it to `e2e`. |
| `SMTP_HOST` / `SMTP_PORT` | `127.0.0.1` / `1025` (Mailpit) |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | See [GitHub OAuth App](#github-oauth-app) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | See [Google OAuth client](#google-oauth-client) |
| `GITHUB_TOKEN` | Personal access token for the plugin sync (public read access is enough) |
| `ADMIN_GITHUB_LOGINS` / `ADMIN_EMAILS` | Comma-separated; these users get the admin role when they sign in |

Never commit `.env`. When you add a variable, add it to `.env.example` with a comment as well.

## Uploads and images

Uploads (the `media` collection) are stored in Garage through `@payloadcms/storage-s3` under the `media/` key prefix. Payload saves the public URL (`${S3_PUBLIC_URL}/media/...`) and browsers load files directly from Garage's web endpoint. `next/image` is allowed to optimize images from `S3_PUBLIC_URL` (see `images.remotePatterns` in `next.config.ts`). In DDEV, `garage.plc.ddev.site` resolves to a private IP, which Next.js blocks by default, so `images.dangerouslyAllowLocalIP` is enabled in development only. A production build run locally (`pnpm build && pnpm start`) cannot optimize Garage images.

## Database, seeding and accounts

- `pnpm migrate` applies the migrations in `src/migrations/` (currently the partial unique indexes for optional unique fields). Run it after pulling new migrations. Create one with `pnpm payload migrate:create <name>`.
- `pnpm seed` creates the base content if it is missing: the "Payload blog" source, the Home, Community, About and Privacy policy pages, and the header and footer menus (only while they are empty). It never changes existing documents, so it is safe in production.
- `pnpm seed:dev` runs `pnpm seed`, then adds sample accounts and entries in every moderation status. It refuses to run with `NODE_ENV=production`.

Sample accounts from `pnpm seed:dev` (all with the password `plc-dev-password`):

| Email | Role |
| --- | --- |
| `admin@example.com` | Admin |
| `moderator@example.com` | Moderator |
| `user@example.com` | Regular user |

Payload's "create first user" screen is disabled. Outside local development, the first admins are the people listed in `ADMIN_GITHUB_LOGINS` / `ADMIN_EMAILS`: they get the admin role when they sign in.

Other accounts:

- **Admin-created users** (Admin panel → Users → Create) get an email with a link to set their password, valid for 7 days. The email is sent by a background job within a minute.
- **Self-registration** (`POST /api/users` for now; the website form comes in M4) sends an activation link. The account can sign in after activation; `POST /api/users/resend-activation` sends a new link.
- All emails end up in Mailpit locally.

## Jobs

Background jobs send emails (invitations, activation resends; notifications from M3) and, from M5, run the post and plugin sync. In development they run automatically inside `pnpm dev` once a minute (`JOBS_AUTORUN`, default `true`). `pnpm worker` runs a standalone worker, and `pnpm payload jobs:run --queue sync` runs queued sync jobs once.

## Tests, lint and types

```bash
pnpm lint          # ESLint
pnpm typecheck     # tsc --noEmit
pnpm test:unit     # Vitest: tests/unit and tests/int (uses the plc_test database)
pnpm test:e2e      # Playwright: tests/e2e
pnpm test          # both
```

Tests never touch development data. `tests/helpers/testEnv.ts` switches them to the `plc_test` database and the `e2e` S3 key prefix. The integration tests and Playwright's global setup reset `plc_test` (empty collections, migrations, `seed`, the three sample accounts and a few published website entries from `tests/helpers/websiteFixtures.ts`). The test server gets a dummy Google Analytics ID so the cookie banner appears; tests intercept requests to Google. Playwright starts its own dev server on port 3100 (build directory `.next-e2e`, jobs triggered by the tests), so it can run next to `pnpm dev`. The E2E email tests read Mailpit's API at `http://127.0.0.1:8025`. Browsers are installed by the DDEV Playwright add-on. If Playwright reports a missing browser, run `pnpm exec playwright install chromium`.

After changing collections or globals, run `pnpm generate:types`. After changing admin components, also run `pnpm generate:importmap`. Commit the generated files.

## OAuth apps

Sign-in with GitHub and Google uses these callback URLs, built from `NEXT_PUBLIC_SERVER_URL`:

| Provider | Callback URL (local) |
| --- | --- |
| GitHub | `https://plc.ddev.site/api/users/oauth/github/callback` |
| Google | `https://plc.ddev.site/api/users/oauth/google/callback` |

In production, replace `https://plc.ddev.site` with the production `NEXT_PUBLIC_SERVER_URL`. Create separate OAuth apps for local development and for each deployed environment.

### GitHub OAuth App

1. Open GitHub **Settings → Developer settings → OAuth Apps → New OAuth App** (or the same page in your organization's settings).
2. Fill in:
   - **Application name:** `Payload Community Portal (local)`
   - **Homepage URL:** `https://plc.ddev.site`
   - **Authorization callback URL:** `https://plc.ddev.site/api/users/oauth/github/callback`
   - Leave **Enable Device Flow** unchecked.
3. Click **Register application**, then **Generate a new client secret**.
4. Put the values into `.env` as `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.

The portal requests the `read:user` and `user:email` scopes when users sign in; nothing else needs to be configured on GitHub. A GitHub OAuth App supports only one callback URL, which is why each environment needs its own app.

### Google OAuth client

1. In the [Google Cloud Console](https://console.cloud.google.com/), select or create a project.
2. **APIs & Services → OAuth consent screen** (Google Auth Platform): configure an **External** app with an app name and support email, and add the scopes `openid`, `email` and `profile`. While the app is in *Testing*, add your Google account under **Test users**.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - **Application type:** Web application
   - **Name:** `Payload Community Portal (local)`
   - **Authorized JavaScript origins:** `https://plc.ddev.site`
   - **Authorized redirect URIs:** `https://plc.ddev.site/api/users/oauth/google/callback`
4. Click **Create** and put the values into `.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

A single Google client can list several redirect URIs, but separate clients per environment keep secrets isolated.

## Troubleshooting

- **`https://plc.ddev.site` shows a DDEV 502 page:** the dev server is not running. Start `pnpm dev` inside the container.
- **Uploads fail with `getaddrinfo ... garage`, or Garage URLs return 502:** the Garage container is not running. Check `ddev describe` on the host and run `ddev restart`.
- **Port 3000 is already in use:** another `next dev` is running in the container. Stop it, or use the running one.
