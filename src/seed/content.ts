export const REPOSITORY_URL = 'https://github.com/payload-community/payload-community-website'

export const PAYLOAD_BLOG_SOURCE = {
  name: 'Payload blog',
  endpoint: 'https://payloadcms.com/api/posts',
  siteUrl: 'https://payloadcms.com/posts',
  type: 'payload-rest',
} as const

export const HEADER_NAV = [
  ['Home', '/'],
  ['News', '/news'],
  ['Resources', '/resources'],
  ['Plugins', '/plugins'],
  ['Builds', '/builds'],
  ['Community', '/community'],
  ['About', '/about'],
] as const

export const FOOTER_NAV = [
  ['Privacy policy', '/privacy'],
  ['GitHub repository', REPOSITORY_URL],
] as const

export const SECTIONS = [
  {
    title: 'News',
    description: 'Posts from the Payload blog and articles written by the community.',
    href: '/news',
  },
  {
    title: 'Resources',
    description: 'Tutorials, videos, courses, tools and other useful links.',
    href: '/resources',
  },
  {
    title: 'Plugins',
    description: 'Payload plugins from GitHub and npm, plus plugins added by the community.',
    href: '/plugins',
  },
  {
    title: 'Builds',
    description: 'Payload distributions that bundle fixes and features not yet released upstream.',
    href: '/builds',
  },
] as const

export const HOME_INTRO = `# Payload CMS Community Portal

News, resources, plugins and builds for [Payload](https://payloadcms.com), collected and shared by the community.`

export const COMMUNITY_MARKDOWN = `## Where to find the community

- [Payload Discord](https://discord.com/invite/payload) for questions and discussions.
- [GitHub Discussions](https://github.com/payloadcms/payload/discussions) for ideas and help.
- [Payload on GitHub](https://github.com/payloadcms/payload) to report issues and contribute.

## Contribute to this portal

Sign in with GitHub or Google to submit posts, resources, plugins and builds. Moderators review every submission before it is published.`

export const ABOUT_MARKDOWN = `The Payload CMS Community Portal is a community project that collects news, learning resources, plugins and builds for Payload in one place.

It is not affiliated with or endorsed by Payload.

The source code is on [GitHub](${REPOSITORY_URL}). Ideas and contributions are welcome.`

/** Generated privacy policy (ADR-022); the operator reviews it before launch. */
export const PRIVACY_MARKDOWN = `This policy explains which personal data the Payload CMS Community Portal processes and why.

## Data we collect

- **Sign-in with GitHub or Google:** your provider user ID, name, email address and avatar URL, and for GitHub your login name. We use them to create and identify your account.
- **Registration with email and password:** your name, email address and a hashed password.
- **Content you submit:** posts, resources, plugins and builds, linked to your account.
- **Notification settings:** whether you want emails about moderation and about your own entries.

## Emails

We send emails to activate your account, reset your password, invite you to an account created by an administrator, and to notify you about moderation, depending on your notification settings.

## Analytics

If the operator enables Google Analytics, it is loaded only after you agree in the cookie banner. You can change your choice at any time with the "Cookie settings" link in the footer.

## Deleting your account

You can delete your account at any time. Your account data is removed, and the content you published stays on the site without your name.

## Contact

For questions about this policy, contact the operator of this site: **[add contact details before launch]**.`
