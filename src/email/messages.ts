/** English email strings, kept in one place so they can move to a translation catalog later. */
export const messages = {
  siteName: 'Payload CMS Community Portal',
  footer:
    'Payload CMS Community Portal is a community project. It is not affiliated with or endorsed by Payload.',
  ignoreIfNotYou: 'If you did not request this, you can ignore this email.',

  verifyEmail: {
    subject: 'Activate your Payload CMS Community Portal account',
    preview: 'Confirm your email address to activate your account.',
    heading: 'Activate your account',
    body: 'Thanks for signing up. Confirm your email address to activate your account, then sign in.',
    button: 'Activate account',
  },
  forgotPassword: {
    subject: 'Reset your Payload CMS Community Portal password',
    preview: 'Use this link to choose a new password.',
    heading: 'Reset your password',
    body: 'Someone asked to reset the password for your account. The link is valid for one hour.',
    button: 'Choose a new password',
  },
  invitation: {
    subject: 'Your Payload CMS Community Portal account',
    preview: 'An account was created for you. Set your password to sign in.',
    heading: 'An account was created for you',
    body: 'An administrator created an account for you on the Payload CMS Community Portal. Set your password to sign in. The link is valid for 7 days; after that, use "Forgot password" on the sign-in page. You can also sign in with GitHub or Google using the same email address.',
    button: 'Set your password',
  },
} as const
