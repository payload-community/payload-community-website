# ADR-025: Email templates use `react-email` 6 instead of `@react-email/components`

- Status: Accepted
- Proposed: 2026-10-10
- Accepted: 2026-10-11
- Amends: [ADR-016](0016-libraries.md) (email templates row)

## Context

ADR-016 chose `@react-email/components` for the email templates. During M2 (2026-10-10) npm reports that package as deprecated ("Package no longer supported"); the React Email project now ships the components (`Html`, `Body`, `Button`, `Container`, …) from the main `react-email` package.

| Package | Version | Weekly downloads | Last publish | Peer deps |
|---|---|---|---|---|
| `react-email` | 6.11.1 | ~5.3M | 2026-10-06 | `react` / `react-dom` ^18 \|\| ^19 |
| `@react-email/render` | 2.1.0 | ~15.9M | 2026-07-10 | (used by `react-email` itself) |
| `@react-email/components` | – | ~7.5M | – | deprecated |

Both work with React 19.2 and run on the server only (jobs and Payload's auth email hooks), so Next.js and Payload versions do not matter.

## Decision

- Templates import components from `react-email` 6.11.1.
- HTML and plain-text bodies are rendered with `render()` from `@react-email/render` 2.1.0 (the same version `react-email` depends on).
- `@react-email/components` is not installed.

## Consequences

- Same template API as before; only the import path changes.
- `react-email` also contains the preview CLI. It is unused in production but makes the dependency larger; the M6 image check (ADR-023) will show whether it needs to be excluded from the standalone trace.
