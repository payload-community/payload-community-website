# ADR-012: Sync updates on documents with a pending draft

- Status: Accepted
- Proposed: 2026-10-09
- Accepted: 2026-10-10

A normal Local API update of a document whose latest version is a draft publishes that draft. For plugins with a pending/rejected user edit, the sync updates the published main document's sync-owned fields via `payload.db.updateOne` and the draft via `payload.update({ draft: true })`. Only place where the DB adapter is used directly.
