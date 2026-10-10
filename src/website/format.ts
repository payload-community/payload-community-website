export const formatDate = (locale: string, value?: string | null): string | null =>
  value ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value)) : null

export const formatCompactNumber = (locale: string, value: number): string =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 1, notation: 'compact' }).format(value)

/** `https://www.example.com/path` → `example.com`. */
export const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
