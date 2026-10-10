import type { NestedKeysStripped } from '@payloadcms/translations'
import { en } from '@payloadcms/translations/languages/en'

/** Custom admin panel strings (Payload i18n). Website strings use Lingui. */
export const plcTranslations = {
  en: {
    plc: {
      invitationNotice:
        'The new user receives an email with a link to set their password (valid for 7 days). They can also sign in with GitHub or Google using the same email address.',
      oauthError: 'Sign-in with the provider failed. Please try again.',
      oauthEmailUnverified:
        'Your email address is not verified with the provider. Verify it there first, then try again.',
      orSignInWithEmail: 'Or sign in with your email and password',
      signInWithGitHub: 'Sign in with GitHub',
      signInWithGoogle: 'Sign in with Google',
    },
  },
}

export type PlcTranslations = typeof plcTranslations.en
export type PlcTranslationKeys = NestedKeysStripped<PlcTranslations>

export const i18n = {
  supportedLanguages: { en },
  translations: plcTranslations,
}
