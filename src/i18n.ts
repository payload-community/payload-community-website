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

      pendingLimitReached:
        'You have {{count}} submissions waiting for review. You can submit more once a moderator approves or rejects one of them, or after you delete one.',
      pendingSlotsInfo:
        'A moderator reviews new entries and changes before they are published. You can submit {{count}} more for review ({{pending}} of {{limit}} waiting).',
      pendingSlotsNotice: 'Saving submits for review ({{count}} of {{limit}} slots free)',
      pendingSlotsNoticeFull: 'Review limit reached ({{limit}} waiting)',

      moderation: 'Moderation',
      moderationQueue: 'Moderation queue',
      moderationTabPending: 'Pending',
      moderationTabRejected: 'Rejected',
      moderationTabUnpublished: 'Unpublished',
      moderationEmpty: 'Nothing here.',
      moderationColumnType: 'Type',
      moderationColumnTitle: 'Title',
      moderationColumnAuthor: 'Author',
      moderationColumnSubmitted: 'Submitted',
      moderationColumnModerated: 'Moderated',
      moderationColumnLinks: 'Review',
      moderationColumnActions: 'Actions',
      moderationEdit: 'Edit',
      moderationVersions: 'Versions',
      moderationUnknownAuthor: 'Unknown',
      moderationShowingFirst: 'Showing the first {{count}} entries.',
      moderationWaiting: 'Waiting for review',
      moderationOpenQueue: 'Open the moderation queue',

      moderationApprove: 'Approve',
      moderationReject: 'Reject',
      moderationRepublish: 'Re-publish',
      moderationUnpublish: 'Unpublish',
      moderationConfirmReject: 'Confirm rejection',
      moderationReasonLabel: 'Reason (optional, sent to the author)',
      moderationApproved: 'Entry approved and published.',
      moderationRejected: 'Entry rejected.',
      moderationRepublished: 'Entry published again.',
      moderationUnpublishedDone: 'Entry unpublished.',
      moderationActionFailed: 'The moderation action failed.',
      moderationNoActions: 'No moderation action is available for this status.',
      moderationUnsavedChanges: 'Save or discard your changes before moderating.',
      authorUnpublishHint:
        'Unpublishing removes the entry from the website. To publish it again, save it: a moderator reviews it first.',
    },
  },
}

export type PlcTranslations = typeof plcTranslations.en
export type PlcTranslationKeys = NestedKeysStripped<PlcTranslations>

export const i18n = {
  supportedLanguages: { en },
  translations: plcTranslations,
}
