# Payload CMS Community Portal

A portal for the Payload CMS community: news from the official blog and community authors, curated resources, plugins, and community builds of Payload CMS, all in one place.

## Technical Stack

- Core: Payload CMS v3.x (latest stable).
- Design: shadcn/ui, Tailwind CSS.
- I18n: Lingui.js.
- Node package manager: PNPM.
- Database: MongoDB.
- File storage: S3-compatible object storage (Garage).
- Email: SMTP.
- Analytics: Google Analytics.
- Observability: OpenTelemetry (traces, metrics, logs, errors).
- Deployment: Kubernetes with a Helm chart.
- Tests: Playwright E2E tests covering the main functionality.

## Hosting

- Production runs in Kubernetes and is deployed with a **Helm chart** that is part of this repository. The app must be stateless (no files on the local disk) so pods can be replaced or scaled.
- All uploaded and downloaded files are stored in S3-compatible storage (Garage). Local development uses the `ddev-garage` add-on.
- Files are **public**: the website serves them directly from the public bucket URL (or a CDN in front of it), not through the app.
- Database migrations and the initial seeding run as a **one-off Kubernetes Job** on install and upgrade, before the new app version starts.
- Scheduled jobs must run exactly once per schedule, even when several app pods are running.
- Observability is done with **OpenTelemetry**: the app exports traces, metrics, logs, and errors to an OTLP endpoint set in the configuration. Without an endpoint, nothing is exported. In production, the telemetry goes to **Grafana** (traces in Tempo, metrics in Mimir/Prometheus, logs in Loki).
- The production email provider (SMTP server, SPF/DKIM setup) is not chosen yet; the app only needs standard SMTP settings.

## Instructions

- Always try to minimize the amount of custom code by reusing the Payload API and SDK.
- Search for and reuse popular NPM libraries instead of reinventing the wheel with custom code.
- Manage technical specifications in the directory `spec`.
- Manage the developer documentation in the directory `docs`.

## Users and Roles

### Authentication

Sign-in methods, available on both the website and the Payload admin panel:

- **OAuth** with **GitHub** or **Google**. This is the only way to **sign up**: on first sign-in, a user account is created automatically from the provider profile (provider user ID, GitHub login for GitHub, name, avatar, email).
- **Email and password**, only for accounts **created manually by an Admin** in the admin panel. There is no public sign-up with email and password.
  - When an Admin creates such an account, the user receives an email with a link to set their own password; Admins never need to know or send passwords.
  - Password users can reset a forgotten password by email.

Account linking:

- If a user signs in with an OAuth provider using the same **verified** email address as an existing account (OAuth or email/password), that provider is linked to the existing account instead of creating a second one.
- A user can have any combination of GitHub, Google, and a password on one account.
- The initial admins are defined in the environment configuration by a list of GitHub logins and a list of email addresses; they get the Admin role on sign-in.

### Roles

- **Admin**: all permissions, including managing users, roles, and sources.
- **Moderator**: moderate (approve, reject, unpublish) and manage (edit, delete) posts, resources, plugins, and builds of any user; receives moderation notifications.
- **No role** (any signed-in user): submit posts, resources, plugins, and builds for moderation; edit and delete their own entries.

### Publishing and moderation (pre-moderation)

Content from regular users is **pre-moderated**: it appears on the website only after a Moderator or Admin approves it.

- A new entry from a regular user starts as **pending** and is not visible publicly.
- A Moderator (or Admin) **approves** it (it becomes published) or **rejects** it with an optional reason that the author sees.
- Authors can **edit and delete their own entries** at any time. Editing a published entry sends the changes for review again; the previously approved version **stays visible** on the website until the changes are approved.
- A Moderator can **unpublish** any published entry. Unpublished entries are hidden from the public website but kept in the database. Authors cannot re-publish entries themselves.
- Entries created by Moderators and Admins are published immediately.
- Imported entries (posts from sources, plugins from GitHub) are published automatically and are read-only for regular users.

### Submission limit

- A regular user can have at most **3 pending entries** at a time, counted across Posts, Resources, Plugins, and Builds together. Edits of published entries waiting for review count too.
- When the limit is reached, a new submission (or an edit that would add a pending entry) is refused with a clear message, and the user can submit again once a moderator has approved or rejected one of their entries, or after they delete one.
- Moderators and Admins have no limit.

### Moderation notifications

Notifications to moderators:

- When a regular user creates an entry or edits a published one, all Moderators and Admins receive an **email notification** with the entry title, type, author, and a link to review it.

Notifications to authors:

- When a Moderator **approves** an entry, its author receives an email with a link to the entry on the website.
- When a Moderator **rejects** an entry, its author receives an email with the rejection reason and a link to edit the entry in the admin panel.

Common rules:

- Users can turn each kind of notification off in their profile.
- Emails are sent in the background and retried on failure; a failed email never blocks saving the content.

### Moderation dashboard

A dashboard in the admin panel for Moderators and Admins to manage content that is not published:

- One list of all **pending** entries across Posts, Resources, Plugins, and Builds, oldest first, with type, title, author, and date of submission.
- Quick actions: open, approve, reject (with a reason).
- Tabs or filters for **rejected** and **unpublished** entries, with the ability to publish them again.
- The number of pending entries is visible on the admin home page.

## Collections

> Field lists below are proposals; review and adjust before implementation.
> Every collection also has the standard `createdAt` / `updatedAt` timestamps.
> "Status" means the moderation status: `pending`, `published`, `rejected`, or `unpublished`. It is changeable only by Moderators and Admins. New entries from regular users start as `pending`; entries from Moderators, Admins, and synchronization start as `published`. A rejection also stores the reason, the moderator, and the date.

### Users

Name, email, password (only for accounts created by Admins), avatar URL, GitHub ID and GitHub login (if linked), Google ID (if linked), roles (Admin, Moderator; empty for regular users), notification settings: moderation notifications on/off (Moderators and Admins only), notifications about own entries (approved/rejected) on/off.

### Sources

Holds the list of sources to parse to get the posts from remote providers. Each source has a type, and each type is handled by its own adapter.

Adapters to implement now:

- `payload-rest`: a website built with Payload CMS that exposes its posts through the Payload REST API.

More adapters (for example RSS/Atom) will be added later, so adding a new source type must only require writing a new adapter.

| Field | Type | Notes |
|---|---|---|
| Name | text | Displayed on post cards. |
| Type | select | `payload-rest` for now. |
| Endpoint | text (URL) | API or feed URL. |
| Site URL | text (URL) | Homepage of the source. |
| Enabled | checkbox | Disabled sources are skipped by the sync. |
| Last synced at | date | Read-only, set by the sync. |
| Last sync status | select | `success`, `partial`, `failed`; read-only. |
| Last sync error | textarea | Read-only. |

### Posts

Contains two kinds of posts:

- **Imported posts**: previews of posts from remote blogs, fetched from Sources. They link to the original article.
- **Community posts**: full articles written directly on the portal by community members, in addition to the imported ones. They have their own page on the portal.

| Field | Type | Notes |
|---|---|---|
| Title | text | |
| Slug | text | Unique, used for community post pages. |
| Origin | select | `imported`, `community`; set automatically. |
| Date | date | Original publication date for imported posts. |
| Source | relationship → Sources | Imported posts only. |
| Author | text | Original author name for imported posts. |
| Created by | relationship → Users | Community posts only; set automatically. |
| Summary | textarea | Plain text, used on cards. |
| Content | rich text (Lexical) | Community posts only. |
| Image | upload → Post Media | |
| URL | text (URL) | Original URL for imported posts; unique, used for de-duplication. |
| External ID | text | ID of the post at the source. |
| Tags | text, multiple | |
| Status | select | See above. |

### Post Media

A separate upload collection for post images, stored in S3. Images of imported posts are **downloaded** into this collection during synchronization (not hotlinked), and each image is downloaded only once. Community authors upload their post images here too.

Fields: file, alt text, original URL (for de-duplication of downloaded images).

### Resources

A list of resources related to Payload: websites, blogs, documentation, videos, courses, tools, communities.

| Field | Type | Notes |
|---|---|---|
| Title | text | |
| URL | text (URL) | Unique. |
| Description | textarea | |
| Type | select | `website`, `blog`, `docs`, `video`, `course`, `tool`, `community`, `other`. |
| Tags | text, multiple | |
| Created by | relationship → Users | Set automatically. |
| Status | select | See above. |

### Plugins

A list of Payload plugins with base information, imported from GitHub and enriched with data from npm.

Users can also **add plugins manually**, for example plugins whose repository lacks the `payload-plugin` topic or is not hosted on GitHub. Rules:

- A manual plugin needs at least a name, a description, and a repository URL or an npm package.
- If its repository is on GitHub, the plugin synchronization fills in the GitHub data (stars, topics, dates). If it has an npm package, the npm data is filled in too.
- Manual plugins are never hidden for lacking the `payload-plugin` topic.
- If the plugin synchronization later finds the same repository, it updates the existing entry instead of creating a duplicate, and the entry keeps its author.
- Fields filled by the synchronization are read-only for users.

| Field | Type | Source | Notes |
|---|---|---|---|
| Origin | select | | `imported` or `manual`; set automatically. |
| Created by | relationship → Users | | Manual plugins only; set automatically. |
| Name | text | GitHub or user | Repository name for imported plugins. |
| Full name | text | GitHub | `owner/repo`, unique when set. |
| Description | textarea | GitHub or user | |
| Repository URL | text | GitHub or user | |
| Homepage | text | GitHub or user | |
| Owner avatar URL | text | GitHub | |
| Topics | text, multiple | GitHub | Used as tags for filtering. |
| Stars | number | GitHub | |
| Forks | number | GitHub | |
| Is fork | checkbox | GitHub | |
| License | text | GitHub | |
| Archived | checkbox | GitHub | Archived on GitHub. |
| Created at (GitHub) | date | GitHub | |
| Last pushed at | date | GitHub | Used as "last update". |
| npm package | text | `package.json` in the repo, or user | Empty if not published. |
| npm latest version | text | npm registry | |
| npm weekly downloads | number | npm API | |
| npm last published at | date | npm registry | |
| Hidden | checkbox | Sync | Set when an imported repo no longer has the topic. |
| Last synced at | date | Sync | |
| Status | select | | See above. |

### Builds

A list of custom builds of Payload CMS from the community, with additional features: bundles of merged PRs, patches, and other improvements on top of the official releases.

| Field | Type | Notes |
|---|---|---|
| Name | text | |
| Slug | text | Unique. |
| Description | textarea | Short summary for the card. |
| Repository URL | text (URL) | |
| Homepage / docs URL | text (URL) | Optional. |
| npm package | text | Optional, how to install the build. |
| Base Payload version | text | For example `3.90.2`. |
| Included changes | array | Items: title, URL (PR, issue, or commit), notes. |
| Tags | text, multiple | |
| Created by | relationship → Users | Set automatically. |
| Status | select | See above. |

## Website Pages

### Listing pages (common rules)

- All listings are paginated and server-rendered; filters, search, and sorting are reflected in the URL so a filtered view can be shared.
- Each listing has **text search**, **filters by tags and by type** (where the collection has them), and **sorting** (by stars where available, and by last update).
- Cards link directly to the **external site** (original article, resource, repository). There are no detail pages for external entries.
- The only exception is community posts, which open their own page on the portal.

### Imported and community posts together

Everywhere posts are listed (News, the frontpage), imported and community posts are shown **together in one list**, sorted by date, with the same card design. Imported posts show their source name. Community posts show their author and have **no "external" label**. Their card opens the post page on the portal.

### Frontpage

Sections:

1. **Hero**: what the portal is, and a call to action to sign in (GitHub or Google) and contribute.
2. **Sections overview**: a short description of each website section with links.
3. **Latest news**: the latest posts, imported and community together.
4. **Top plugins**: the most-starred plugins.
5. **Featured builds**: the latest builds.

### News

An aggregator of news related to Payload CMS.

Displays blog-style previews of imported and community posts (image, title, date, source or author, summary), newest first. Search, filter by source and tags.

### Resources

Displays the list of documents from the "Resources" collection. Search, filter by type and tags.

### Plugins

Displays the list of documents from the "Plugins" collection: projects with the topic `payload-plugin` and manually added plugins together, showing the base information (name, description, creation date, last update date, other topics, number of stars, npm version and weekly downloads). Search, filter by topics, sort by stars or last update. Hidden plugins are not displayed.

### Builds

Displays the list of documents from the "Builds" collection. Search, filter by tags and base Payload version, sort by last update.

### Community

A page with Lexical-editor content, where editors write an article about the Payload community and link to the resources. Editable by Admins and Moderators.

### About

An article describing the project.

## Navigation

Main menu:

- Home
- News
- Resources
- Plugins
- Builds
- Community
- About

## Design and Branding

- Name: **Payload CMS Community Portal**.
- Use the "Website" template from the Payload CMS templates as the base.
- Colors, typography, and overall look follow the Payload Website template demo and the official Payload website (payloadcms.com), including light and dark modes.
- The footer states that this is a community project, not affiliated with or endorsed by Payload.

## Internationalization

- Only English at launch.
- Every user-facing string of the website is translatable through Lingui, so adding a language only requires adding a translation catalog.
- Content translation (localized collection fields) is not needed for now.

## Non-functional Requirements

- **SEO**: meta title and description on every page, Open Graph and Twitter cards, canonical URLs, `sitemap.xml`, `robots.txt`, structured data where it fits.
- **Analytics**: Google Analytics 4, with the measurement ID set through an environment variable; disabled when not configured. It loads only after the visitor accepts analytics cookies.
- **Privacy and GDPR**: a privacy policy page; a cookie consent banner (required for Google Analytics) where visitors can accept or reject analytics and change their choice later; collect only the profile data needed from GitHub and Google; users can delete their account.
- **Accessibility**: WCAG 2.2 AA.
- **Performance**: Lighthouse score of 90+ on main pages; optimized images.
- **Security**: secrets only in environment variables; protected job endpoints; rate limiting on public write endpoints.
- **Observability**: OpenTelemetry traces for requests, database calls, outgoing HTTP calls, and jobs; metrics; structured logs correlated with traces; errors recorded with stack traces. Health endpoints for Kubernetes probes.

## Cron Jobs

### Post synchronization

Parses the enabled news sources through their adapters and imports new items into the local database. Downloads post images into "Post Media". Already imported posts are updated, not duplicated.

Add these sources to the database:

- Payload blog, https://payloadcms.com/posts/blog, type `payload-rest`, endpoint `https://payloadcms.com/api/posts`.

Schedule: every 6 hours.

### Plugin synchronization

Searches GitHub for projects with the topic `payload-plugin` and imports their base information into the local database, then enriches it with npm data (latest version, weekly downloads, last publish date).

Rules:

- Original (non-fork) repositories are imported regardless of the number of stars.
- Forks are imported only if they have more than 2 stars.
- If a repository no longer has the topic (or no longer exists), its plugin is hidden, not deleted.
- Manually added plugins are refreshed too: GitHub data if the repository is on GitHub, npm data if they have an npm package.

Schedule: every day.
