import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { OxlintConfig } from 'oxlint'

// The `lint` block of vite.config.ts (`vp lint`), kept in its own file
// because the boundary zones are computed.
//
// Everything runs in Oxlint. The two rules ESLint used to exist for run as
// Oxlint JS plugins:
//   - `import-js/no-restricted-paths`: eslint-plugin-import's rule, loaded
//     as-is (aliased, since `import` is Oxlint's native plugin) and resolving
//     `@/…` through eslint-import-resolver-typescript;
//   - `rej/no-rhf-watch`: the react-hook-form watch() guard that used to be
//     a `no-restricted-syntax` selector (see ./rej-plugin.mjs).

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// Feature names come from src/features/ at config load, so adding or
// removing a feature needs no lint changes.
const FEATURES = readdirSync(join(root, 'src/features'), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)

// A feature cannot import from another feature.
const crossFeatureZones = FEATURES.flatMap((target) =>
  FEATURES.filter((from) => from !== target).map((from) => ({
    target: `./src/features/${target}`,
    from: `./src/features/${from}`,
    message:
      'Cross-feature imports are forbidden. Move shared code to src/lib, src/components, or src/hooks.',
  })),
)

// The app layer is src/routes (route files plus their `-components/`) and
// src/router.tsx.
// Dependency direction: shared -> features -> app.
const SHARED_LAYERS = ['components', 'hooks', 'lib', 'stores', 'copy']
const sharedLayerZones = SHARED_LAYERS.map((layer) => ({
  target: `./src/${layer}`,
  from: ['./src/features', './src/routes', './src/router.tsx'],
  message: `Shared ${layer} cannot depend on features or app. The dependency direction is shared -> features -> app.`,
}))

const featureZone = {
  target: './src/features',
  from: ['./src/routes', './src/router.tsx'],
  message:
    'Features cannot depend on app. The dependency direction is shared -> features -> app.',
}

export const lintConfig: OxlintConfig = {
  // typeAware turns on rules that need type information
  // (no-floating-promises, no-base-to-string, no-misused-spread, …) through
  // oxlint-tsgolint, on the TypeScript 7 compiler. Type-checking itself stays
  // in `pnpm type-check` (tsc from typescript-native), so typeCheck is off.
  options: { typeAware: true },
  plugins: [
    'typescript',
    'unicorn',
    'oxc',
    'react',
    'jsx-a11y',
    'import',
    'vitest',
  ],
  jsPlugins: [
    { name: 'import-js', specifier: 'eslint-plugin-import' },
    './lint/rej-plugin.mjs',
  ],
  categories: { correctness: 'error' },
  env: { browser: true, node: true, es2024: true },
  settings: {
    'import/resolver': {
      typescript: { project: join(root, 'tsconfig.json') },
    },
  },
  ignorePatterns: [
    'coverage/**',
    'dist/**',
    '.wrangler/**',
    '.tanstack/**',
    'src/routeTree.gen.ts',
    '.claude/worktrees/**',
    '.worktrees/**',
    'storybook-static/**',
  ],
  rules: {
    // React Hooks + React Compiler rules, at the severities
    // eslint-plugin-react-hooks used for this repo.
    'react/rules-of-hooks': 'error',
    'react/exhaustive-deps': 'warn',
    'react/static-components': 'error',
    'react/use-memo': 'error',
    'react/preserve-manual-memoization': 'error',
    'react/incompatible-library': 'warn',
    'react/immutability': 'error',
    'react/globals': 'error',
    'react/refs': 'error',
    'react/set-state-in-effect': 'warn',
    'react/error-boundaries': 'error',
    'react/purity': 'error',
    'react/set-state-in-render': 'error',
    'react/unsupported-syntax': 'warn',
    'react/no-unescaped-entities': 'off',

    // Off for good: test-style preferences, an intentional pattern, and a
    // false positive TypeScript already covers.
    'vitest/require-mock-type-parameters': 'off',
    'vitest/require-to-throw-message': 'off',
    // Tests narrow discriminated unions (`if (!result.success)`) before
    // asserting on the error branch.
    'vitest/no-conditional-expect': 'off',
    // Search focuses its only input on purpose.
    'jsx-a11y/no-autofocus': 'off',
    // Flags members of conditional (browser-only) exports; tsc already
    // checks namespace members.
    'import/namespace': 'off',
    // The ARIA roles in use are deliberate: role="status" live regions,
    // role="img" on composite charts built from many elements, and the
    // custom slider/segmented controls in the design tool. The suggested
    // native tags (<output>, <img>, <input>) would change semantics or
    // styling, so this stays off by decision, not as debt.
    'jsx-a11y/prefer-tag-over-role': 'off',
    // A labelled region with tabIndex={0} is the WCAG technique for making
    // scrollable content reachable by keyboard (axe scrollable-region-focusable).
    'jsx-a11y/no-noninteractive-tabindex': [
      'error',
      { roles: ['tabpanel', 'region'] },
    ],

    // Feature boundaries (bulletproof-react).
    'import-js/no-restricted-paths': [
      'error',
      { zones: [...crossFeatureZones, ...sharedLayerZones, featureZone] },
    ],
    'rej/no-rhf-watch': 'error',
  },
}
