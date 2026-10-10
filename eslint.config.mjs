import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'
import pluginLingui from 'eslint-plugin-lingui'

/** Website code translated with Lingui (the admin panel uses Payload's i18n). */
const websiteFiles = [
  'src/app/(frontend)/**/*.{ts,tsx}',
  'src/blocks/**/*.tsx',
  'src/components/**/*.tsx',
  'src/Footer/**/*.tsx',
  'src/Header/**/*.tsx',
  'src/heros/**/*.tsx',
  'src/providers/**/*.tsx',
  'src/website/**/*.{ts,tsx}',
]
const websiteIgnores = [
  'src/components/ui/**',
  'src/components/BeforeLogin/**',
  'src/Footer/RowLabel.tsx',
  'src/Header/RowLabel.tsx',
  // Route handlers return machine-readable responses (robots.txt, sitemaps, JSON).
  'src/app/(frontend)/**/route.{ts,tsx}',
]

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ...pluginLingui.configs['flat/recommended'],
    files: websiteFiles,
    ignores: websiteIgnores,
  },
  {
    files: websiteFiles,
    ignores: websiteIgnores,
    plugins: { lingui: pluginLingui },
    rules: {
      'lingui/no-unlocalized-strings': [
        'warn',
        {
          // Identifiers, slugs, paths and directives; display copy has spaces or starts uppercase.
          ignore: ['^(?![A-Z])\\S+$', '^[A-Z0-9_-]+$', '^use (client|server)$'],
          ignoreFunctions: [
            'console.*',
            'cn',
            'cva',
            'clsx',
            '*.logger.*',
            '*.addEventListener',
            '*.get',
            'Error',
            'Response',
            'getCachedGlobal',
            'revalidatePath',
            'revalidateTag',
            'router.push',
            'setHeaderTheme',
          ],
          ignoreNames: [
            { regex: { pattern: 'className$', flags: 'i' } },
            '__html',
            '@context',
            '@type',
            'query-input',
            'Cache-Control',
            'controls',
            'data-testid',
            'position',
            'rel',
            'size',
            'sizes',
            'src',
            'styleName',
          ],
        },
      ],
    },
  },
  {
    rules: {
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: false,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|ignore)',
        },
      ],
    },
  },
  {
    ignores: [
      '.ddev/',
      '.next/',
      '.next-e2e/',
      'playwright-report/',
      'test-results/',
      'src/locales/**/messages.ts',
      'src/payload-types.ts',
      'src/payload-generated-schema.ts',
      'src/app/(payload)/admin/importMap.js',
    ],
  },
]

export default eslintConfig
