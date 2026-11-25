import { build } from 'esbuild'
import { builtinModules, createRequire } from 'node:module'
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const nodeBuiltins = new Set(builtinModules)

const root = path.resolve(import.meta.dirname, '..')
const sourceRoot = path.join(root, 'src')

const isFile = (candidate) => {
  try {
    return statSync(candidate).isFile()
  } catch {
    return false
  }
}

/**
 * Node ESM does not add a file extension for a package subpath when that package has no
 * `exports` map (`next/cache` is `next/cache.js`). tsx and Next's bundler do. Rewrite those
 * external specifiers so `node cli.mjs` can load them.
 */
const externalSpecifier = (specifier) => {
  if (specifier.startsWith('node:')) return specifier
  const parts = specifier.split('/')
  const pkgName = specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
  const subpath = specifier.startsWith('@') ? parts.slice(2).join('/') : parts.slice(1).join('/')
  if (!subpath || path.extname(subpath)) return specifier

  let pkgJson
  try {
    pkgJson = JSON.parse(readFileSync(require.resolve(`${pkgName}/package.json`), 'utf8'))
  } catch {
    return specifier
  }
  if (pkgJson.exports) return specifier

  let resolved
  try {
    resolved = require.resolve(specifier)
  } catch {
    return specifier
  }
  const extension = path.extname(resolved)
  if (!extension) return specifier
  if (path.basename(resolved) === `index${extension}`) return `${specifier}/index${extension}`
  return `${specifier}${extension}`
}

const resolveSource = (specifier) => {
  const base = path.join(sourceRoot, specifier)
  const candidates = [
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.mjs`,
    `${base}.json`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
    path.join(base, 'index.js'),
    base,
  ]
  const found = candidates.find((candidate) => isFile(candidate))
  if (!found) throw new Error(`Cannot resolve @/${specifier}`)
  return found
}

await build({
  absWorkingDir: root,
  banner: {
    js: `import { createRequire as __cliCreateRequire } from 'node:module'
import { dirname as __cliDirname } from 'node:path'
import { fileURLToPath as __cliFileURLToPath } from 'node:url'
const require = __cliCreateRequire(import.meta.url)
const __filename = __cliFileURLToPath(import.meta.url)
const __dirname = __cliDirname(__filename)
`,
  },
  bundle: true,
  conditions: ['import', 'module', 'default'],
  entryPoints: [path.join(sourceRoot, 'cli/index.ts')],
  format: 'esm',
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  legalComments: 'none',
  logLevel: 'info',
  outfile: path.join(root, 'cli.mjs'),
  platform: 'node',
  plugins: [
    {
      name: 'bundle-our-code',
      setup(result) {
        // Bundle our sources and npm packages. sharp stays external: it is a native
        // addon already copied into the standalone trace. next/cache is a no-op stub.
        result.onResolve({ filter: /^@\// }, (args) => ({
          path: resolveSource(args.path.slice(2)),
        }))
        result.onResolve({ filter: /^@payload-config$/ }, () => ({
          path: path.join(sourceRoot, 'payload.config.ts'),
        }))
        result.onResolve({ filter: /^next\/cache(\.js)?$/ }, () => ({
          path: path.join(root, 'scripts/cli-next-cache-stub.mjs'),
        }))
        result.onResolve({ filter: /.*/ }, (args) => {
          if (args.kind === 'entry-point') return undefined
          if (args.path.startsWith('.') || path.isAbsolute(args.path)) return undefined
          if (args.path.startsWith('node:')) return { external: true, path: args.path }
          if (nodeBuiltins.has(args.path)) return { external: true, path: `node:${args.path}` }
          // sharp ships a native binary. Next's standalone trace already includes it.
          // Everything else is bundled: the standalone node_modules copy of Payload is only
          // the files the Next server bundle did not already inline, so it cannot be imported.
          const name = args.path.startsWith('@')
            ? args.path.split('/').slice(0, 2).join('/')
            : args.path.split('/')[0]
          if (name !== 'sharp') return undefined
          return { external: true, path: externalSpecifier(args.path) }
        })
      },
    },
  ],
  target: 'node24',
  // The repo tsconfig sets `jsx: react-jsx`, which emits `react/jsx-runtime` named imports.
  // Those fail under plain Node for the CJS runtime shipped in the standalone output.
  tsconfigRaw: { compilerOptions: { jsx: 'react' } },
})
