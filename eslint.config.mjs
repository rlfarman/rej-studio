import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import nextConfig from 'eslint-config-next'
import reactHooks from 'eslint-plugin-react-hooks'

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

const config = [
  {
    ignores: ['coverage/**', '.claude/worktrees/', '.worktrees/', '.vercel/'],
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
      // Enforce copy centralisation: user-facing strings must come from
      // copy modules, not be inlined as JSX text or string-literal props.
      // Whitespace-only and single-char punctuation are ignored.
      'react/jsx-no-literals': [
        'warn',
        {
          noStrings: true,
          allowedStrings: [
            ' ',
            '.',
            ',',
            ':',
            ';',
            '·',
            '—',
            '–',
            '|',
            '/',
            '#',
            '(',
            ')',
            '…',
            '\u2019',
          ],
          ignoreProps: true,
          noAttributeStrings: false,
        },
      ],
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
    },
  },
  {
    files: ['*.config.mjs'],
    rules: {
      'import/no-anonymous-default-export': 'off',
    },
  },
]

export default config
