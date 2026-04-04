import nextConfig from 'eslint-config-next'
import reactHooks from 'eslint-plugin-react-hooks'

const config = [
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
      // Enforce bulletproof-react dependency direction: shared -> features -> app
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            // Features cannot import from each other
            {
              target: './src/features/gene-search',
              from: './src/features/design-tool',
              message:
                'Cross-feature imports are forbidden. Move shared code to src/lib, src/components, or src/hooks.',
            },
            {
              target: './src/features/design-tool',
              from: './src/features/gene-search',
              message:
                'Cross-feature imports are forbidden. Move shared code to src/lib, src/components, or src/hooks.',
            },
            // Shared code cannot import from features or app
            {
              target: './src/components',
              from: ['./src/features', './src/app'],
              message:
                'Shared components cannot depend on features or app. The dependency direction is shared -> features -> app.',
            },
            {
              target: './src/hooks',
              from: ['./src/features', './src/app'],
              message:
                'Shared hooks cannot depend on features or app. The dependency direction is shared -> features -> app.',
            },
            {
              target: './src/lib',
              from: ['./src/features', './src/app'],
              message:
                'Shared lib cannot depend on features or app. The dependency direction is shared -> features -> app.',
            },
            {
              target: './src/context',
              from: ['./src/features', './src/app'],
              message:
                'Shared context cannot depend on features or app. The dependency direction is shared -> features -> app.',
            },
            // Features cannot import from app
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
