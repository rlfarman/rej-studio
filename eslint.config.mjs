import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import nextConfig from 'eslint-config-next'
import reactHooks from 'eslint-plugin-react-hooks'
import oxlint from 'eslint-plugin-oxlint'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Discover feature names from src/features/ at config load.
// Adding or removing a feature requires no eslint changes.
const FEATURES = readdirSync(join(__dirname, 'src/features'), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)

// Cross-feature imports are forbidden: for every (a, b) where a !== b,
// a feature cannot import from another feature.
const crossFeatureZones = FEATURES.flatMap((target) =>
  FEATURES.filter((from) => from !== target).map((from) => ({
    target: `./src/features/${target}`,
    from: `./src/features/${from}`,
    message:
      'Cross-feature imports are forbidden. Move shared code to src/lib, src/components, or src/hooks.',
  })),
)

// Shared layers cannot depend on features or app. Direction: shared -> features -> app.
const SHARED_LAYERS = ['components', 'hooks', 'lib', 'stores']
const sharedLayerZones = SHARED_LAYERS.map((layer) => ({
  target: `./src/${layer}`,
  from: ['./src/features', './src/app'],
  message: `Shared ${layer} cannot depend on features or app. The dependency direction is shared -> features -> app.`,
}))

// The React Compiler memoizes react-hook-form's watch() (its identity never
// changes), so a component reading it renders stale values.
const RHF_WATCH_MESSAGE =
  "react-hook-form's watch() goes stale under the React Compiler. Use useWatch({ control, name }), or getValues() for a one-off read."

const config = [
  {
    // .venv/ and venv/ are Python environments (uv sync); pyright ships
    // bundled JS there that isn't ours to lint.
    ignores: [
      'coverage/**',
      '.claude/worktrees/',
      '.worktrees/',
      '.vercel/',
      '.venv/',
      'venv/',
    ],
  },
  {
    // The React Hooks and Next rules now run in Oxlint, which honors the
    // existing eslint-disable comments and reports stale ones itself
    // (`oxlint --report-unused-disable-directives` in `pnpm lint`). ESLint
    // would flag those same comments as unused, so it stays quiet here.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
  },
  ...nextConfig,
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react/no-unescaped-entities': 'off',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            ...crossFeatureZones,
            ...sharedLayerZones,
            {
              target: './src/features',
              from: './src/app',
              message:
                'Features cannot depend on app. The dependency direction is shared -> features -> app.',
            },
          ],
        },
      ],
      // Oxlint's react/incompatible-library only catches watch() on
      // useForm(), not on useFormContext(), and the form fields read their
      // values through the context.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "VariableDeclarator[init.callee.name=/^useForm(Context)?$/] > ObjectPattern > Property[key.name='watch']",
          message: RHF_WATCH_MESSAGE,
        },
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.property.name='watch']",
          message: RHF_WATCH_MESSAGE,
        },
      ],
    },
  },
  {
    files: ['*.config.mjs'],
    rules: {
      'import/no-anonymous-default-export': 'off',
    },
  },
  // Oxlint runs first in `pnpm lint` (see .oxlintrc.json). Switch off the
  // ESLint rules it already covers so each problem is reported once and
  // ESLint only does what Oxlint can't (the import-boundary rules above).
  // Keep this last so it overrides the configs before it.
  ...oxlint.buildFromOxlintConfigFile('./.oxlintrc.json'),
]

export default config
