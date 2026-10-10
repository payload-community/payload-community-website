import { defineConfig } from '@lingui/cli'
import { formatter } from '@lingui/format-po'

export default defineConfig({
  catalogs: [
    {
      // Admin components (BeforeLogin) use Payload's i18n, not Lingui.
      exclude: ['**/node_modules/**', '<rootDir>/src/components/BeforeLogin/**'],
      include: [
        '<rootDir>/src/app/(frontend)',
        '<rootDir>/src/blocks',
        '<rootDir>/src/components',
        '<rootDir>/src/Footer',
        '<rootDir>/src/Header',
        '<rootDir>/src/heros',
        '<rootDir>/src/website',
      ],
      path: '<rootDir>/src/locales/{locale}/messages',
    },
  ],
  compileNamespace: 'ts',
  format: formatter({ lineNumbers: false }),
  locales: ['en'],
  sourceLocale: 'en',
})
