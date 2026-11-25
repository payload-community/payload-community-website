# ADR-034: Releases with release-it, changelog from commits, image on GHCR

- Status: Proposed
- Proposed: 2026-11-25

## Context

Versions were bumped by hand: a Keep a Changelog "Unreleased" section, a `package.json` version, and an annotated tag the owner pushed. The tag `v0.1.0-alpha.1` was never pushed, and there is no GitHub Actions workflow. The container image from [ADR-033](0033-image-build-without-database.md) is only built on a host that has Docker.

Commits on `main` already follow Conventional Commits (`feat`, `fix`, `docs`, `chore`, `test`). The package is `"private": true`.

Options considered:

- Keep the hand-written changelog and add a workflow that only tags and pushes the image.
- `@release-it/keep-a-changelog`, which promotes an Unreleased section someone still writes by hand.
- `release-it` with `@release-it/conventional-changelog`, which writes `CHANGELOG.md` from the commits since the last `v*` tag, then a workflow that creates the GitHub release and pushes the image.

## Decision

Use `release-it` 21.1.3 and `@release-it/conventional-changelog` 12.0.2 (devDependencies). Configuration is `.release-it.json`.

| Package | Version | Published | Weekly downloads | Role |
|---|---|---|---|---|
| `release-it` | 21.1.3 | 2026-11-22 | 1.0M | Version bump, git commit and annotated tag, GitHub release |
| `@release-it/conventional-changelog` | 12.0.2 | 2026-09-14 | 0.5M | Changelog and recommended bump from Conventional Commits |

Both run on Node 24. They are not imported by the Next.js app, so they do not affect Payload, Next.js or React.

- `feat` → Added (minor), `fix` → Fixed (patch), `perf` → Changed (patch). `docs`, `chore`, `refactor`, `test`, `build`, `ci` and `style` are omitted. A breaking change still recommends a major bump.
- npm publish is off. The package stays private.
- GitHub Actions workflow `Release` (`workflow_dispatch` on `main`) runs lint, `pnpm i18n:extract` (must not change the tree) and typecheck, then `release-it`. It pushes the commit and tag with `contents: write` and opens the GitHub release.
- Workflow `Container image` builds `Dockerfile` for `linux/amd64` with `APP_VERSION` set to the version, and pushes `ghcr.io/<repository>:<version>` (`ghcr.io/payload-community/payload-community-website` for this repo). Stable versions are also tagged `latest`. The Release workflow calls it after a real release. A `v*` tag push or a manual run rebuilds an existing tag.
- The default pre-release id is `alpha`, so the next release from `0.1.0-alpha.1` is `0.1.0-alpha.2` until someone clears that input.
- `CHANGELOG.md` keeps the hand-written 0.1.0-alpha.1 section. There is no Unreleased section: the next release-it run writes the following version from git history. The intro paragraph is the plugin `header`, so it stays above generated sections.
- The missing tag `v0.1.0-alpha.1` is created on commit `4df4469` by the Release workflow when that is still the current version. Later missing tags fail the workflow.

`pnpm test` stays on the release checklist and is not part of the workflow: the suite needs MongoDB, Garage and Mailpit.

## Consequences

- Release notes follow commit subjects. A vague `feat:` message becomes the public note.
- The first generated release lists every `feat`, `fix` and `perf` since `v0.1.0-alpha.1`, including work that used to sit in the hand-written Unreleased section (site name, container image, build without a database).
- Image builds happen on GitHub-hosted runners, not in the DDEV web container (Docker is not installed there).
- Only `linux/amd64` is published. An arm64 node image would be a later change.
- A branch protection rule that rejects the Actions token blocks the release push. The workflow does not use a personal access token.
- A tag pushed by that token does not start another workflow, so the image is built once, from the Release workflow. A tag pushed by a person starts the image workflow on its own.
- GHCR packages are private until the visibility API call succeeds. That step is allowed to fail; an owner may have to make the package public once.
