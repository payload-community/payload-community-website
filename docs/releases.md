# Releases

Releases are cut with [release-it](https://github.com/release-it/release-it) and published from GitHub Actions. The design is [§18.4](../spec/architecture/operations.md#184-releases-and-the-container-registry) and [ADR-034](../spec/decisions/0034-release-it-and-github-image-publish.md).

## What a release does

1. Bumps `package.json`.
2. Prepends `CHANGELOG.md` from Conventional Commits since the previous `v*` tag. `feat` is listed under Added, `fix` under Fixed, and `perf` under Changed. Other types stay out of the changelog. The 0.1.0-alpha.1 section was written by hand; do not edit a generated section in place.
3. Commits `chore: release vX.Y.Z`, pushes it to `main`, and pushes the annotated tag `vX.Y.Z`.
4. Creates the GitHub release. Pre-release versions are marked as pre-releases.
5. Builds the container image and pushes it to `ghcr.io/payload-community/payload-community-website` (the repository name, lowercased). The tag is the version. A stable version is also tagged `latest`. `APP_VERSION` is that version. The image is `linux/amd64`.

The package is private, so nothing is published to npm.

## Before you start

On `main`, with a clean tree that is up to date with origin:

1. `pnpm lint`, `pnpm typecheck`, `pnpm i18n:extract` (no catalog diff), `pnpm test`, `pnpm build`.
2. The manual OAuth check in the [release checklist](../spec/roadmap.md#release-checklist-for-every-tag).
3. The tag for the current `package.json` version must exist. `v0.1.0-alpha.1` was never pushed; the Release workflow creates that one tag on `4df4469` if it is missing, and does not build an image for it. Later versions are tagged by release-it. Keep the workflow on the default `GITHUB_TOKEN`: a personal access token would also start the image workflow for that bootstrap tag, and that commit has no `Dockerfile`.

Commit messages on `main` should stay Conventional Commits. A `feat` commit recommends a minor bump, a `fix` or `perf` commit a patch bump, and a breaking change (`feat!:` or `BREAKING CHANGE:`) a major bump.

## Cut a release

In GitHub: Actions → Release → Run workflow, on `main`.

| Input | Use |
|---|---|
| Increment `auto`, pre-release id `alpha` | Next alpha while the current version is a pre-release (`0.1.0-alpha.1` → `0.1.0-alpha.2`). This is the default. |
| Increment `patch`, pre-release id empty | First stable `0.1.0`. `auto` would choose `minor` when a `feat` commit landed, and jump to `0.2.0`. |
| Increment `minor` or `major`, pre-release id empty | Stable minor or major. |
| Version | Exact version, for example `0.2.0-alpha.0`. Overrides the increment. |
| Dry run | Prints the bump and changelog. Does not commit, tag, or push an image. |

The workflow repeats lint, catalog extract, and typecheck. It does not run `pnpm test`. `main` must allow the Actions token to push the release commit (a ruleset that blocks Actions pushes will fail the job).

Preview the changelog locally with `pnpm release:dry`. That command does not publish.

`pnpm release` runs the same tool locally. It needs `GITHUB_TOKEN` with permission to push to `main` and to open a release. Pushing the tag starts the Container image workflow. Prefer the Release workflow so the checks, the GitHub release, and the image stay in one run. The workflow uses the default `GITHUB_TOKEN`; a tag it pushes does not start a second image build.

## Rebuild an image

Actions → Container image → Run workflow, and pass the existing version (`0.1.0-alpha.2`). The workflow checks out tag `v0.1.0-alpha.2`. A push of a `v*` tag (from a local `pnpm release`) starts the same workflow.

The first push creates the GHCR package. The workflow then asks GitHub to make that package public. If the token cannot change visibility, the step is allowed to fail and the image is still private until an owner changes it in the package settings.
