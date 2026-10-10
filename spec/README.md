# Specifications

What the portal must do, how it is designed, and why. Developer, moderator and operator guides live in `docs/` (created in M1); rules for agents are in [`../AGENTS.md`](../AGENTS.md).

| Document | Owner | Purpose |
|---|---|---|
| [`BRIEF.md`](BRIEF.md) | Product owner (read-only for agents) | Product requirements: the source of truth for *what* to build. |
| [`bootstrap-prompt.md`](bootstrap-prompt.md) | Product owner (read-only for agents) | Environment, stack, milestones and implementation guidance for the bootstrap. |
| [`architecture/`](architecture/README.md) | Agents, reviewed by the owner | Technical design: stack, data model, access control, moderation, auth, sync, frontend, operations. |
| [`decisions/`](decisions/README.md) | Agents, accepted by the owner | Architecture decision records (one file per decision). |
| [`open-questions.md`](open-questions.md) | Agents ↔ owner | Ambiguities with their default, resolved questions, and proposed changes to the read-only documents. |
| [`ideas.md`](ideas.md) | Anyone | Feature ideas with value, effort and risks; implemented only after approval. |

## How changes flow

1. A requirement changes → the owner edits `BRIEF.md` (agents propose wording in `open-questions.md`, section "Proposed changes").
2. The design changes → update the relevant `architecture/` file in the same commit as the code, and add an ADR when a decision is involved.
3. An ambiguity is found → pick the least-effort reversible option, add an ADR if it shapes the design, and list it in `open-questions.md`.

## Conventions

- File names: lowercase kebab-case; uppercase only for conventional entry files (`README.md`, `BRIEF.md`, `AGENTS.md`, `CHANGELOG.md`).
- ADRs: `decisions/NNNN-short-title.md`, referenced in text as `ADR-NNN`.
- Architecture section numbers (`§6.3`) are global across `architecture/` files and stay stable.
- Open questions: `Q<n>` (product), `T<n>` (technical), `P<n>` (proposed changes to read-only documents); numbers are never reused.
