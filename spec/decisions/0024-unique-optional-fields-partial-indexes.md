# ADR-024: Unique-when-set fields use partial unique indexes

- Status: Accepted
- Proposed: 2026-10-10
- Accepted: 2026-10-10

## Context

`users.githubId`, `users.googleId`, `posts.url`, `post-media.originalUrl` and `plugins.fullName` must be unique when set and may be empty (T3).

Checked on 2026-10-10:

- `@payloadcms/db-mongodb` 3.90.2 `buildSchema`: a field with `unique: true` that is not `required` (or is in a drafts-enabled collection) gets a **sparse** unique index. Versions collections are built with `disableUnique`, so drafts never hit unique indexes.
- MongoDB sparse indexes skip documents where the field is **missing**, but still index an explicit `null` (and `""`). Clearing a value (disconnecting a provider, removing a repository URL) has to write `null` — Mongoose 8 (used by the adapter) drops `undefined` keys from updates, so "store undefined instead of null" cannot clear a value. Two cleared documents would then fail with E11000. (DeepWiki's summary claims the sparse index ignores `null`; the MongoDB documentation and the adapter code say otherwise.)
- Payload's collection `indexes` option supports only `fields` and `unique` — no `partialFilterExpression`.
- Related upstream issues: [#16298](https://github.com/payloadcms/payload/issues/16298) (non-sparse unique index for conditionally required fields, duplicate `null`s), [#15126](https://github.com/payloadcms/payload/issues/15126) (unique + autosave/drafts on create). No upstream support for partial indexes.
- The adapter's `handleError` turns any E11000 with `keyValue` into Payload's "Value must be unique" `ValidationError` on that field.

## Decision

- These fields get `index: true` (query performance) but not `unique: true`.
- A Payload migration creates partial unique indexes: `{ <field>: 1 }`, `{ unique: true, name: 'uniq_<field>', partialFilterExpression: { <field>: { $type: 'string' } } }` — `null` and missing values are excluded.
- A shared `beforeValidate` field hook normalizes `''`/whitespace to `null`.
- `users.email` stays a regular required `unique: true` field.

## Consequences

- Correct "unique when set" semantics with clean admin/REST errors and no custom validation queries.
- The indexes live in migrations, so `payload migrate` must run before the app uses a fresh database — already the case (migrate Job in Kubernetes; `pnpm payload migrate` in local setup and in the E2E global setup).
- Mongoose's `autoIndex` never drops unknown indexes, so Payload and our migration do not fight over them.
