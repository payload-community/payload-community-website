import type { TextFieldSingleValidation } from 'payload'

export const isHttpURL = (value: string): boolean => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

/** Optional unless the field is `required`; only absolute http(s) URLs. */
export const validateURL: TextFieldSingleValidation = (value, { required }) => {
  if (!value) return required ? 'This field is required.' : true
  return isHttpURL(value) || 'Enter a full URL starting with https://'
}
