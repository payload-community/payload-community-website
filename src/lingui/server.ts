import { setupI18n, type I18n, type Messages } from '@lingui/core'
import { setI18n } from '@lingui/react/server'

import { messages as en } from '@/locales/en/messages'

export const LOCALES = ['en'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'en'

const catalogs: Record<Locale, Messages> = { en }

const instances = Object.fromEntries(
  LOCALES.map((locale) => [locale, setupI18n({ locale, messages: { [locale]: catalogs[locale] } })]),
) as Record<Locale, I18n>

export const getCatalog = (locale: Locale = DEFAULT_LOCALE): Messages => catalogs[locale]

/**
 * Lingui's App Router pattern: layouts and pages render independently, so every layout, page and
 * `generateMetadata` calls this before using `<Trans>` or `t` in a server component.
 */
export const initLingui = (locale: Locale = DEFAULT_LOCALE): I18n => {
  const i18n = instances[locale]
  setI18n(i18n)
  return i18n
}
