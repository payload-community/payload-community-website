import type { FieldHook } from 'payload'

/** Unique-when-set fields (ADR-024): an empty string must never reach the partial unique index. */
export const emptyToNull: FieldHook = ({ value }) =>
  typeof value === 'string' && value.trim() === '' ? null : value
