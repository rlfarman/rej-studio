import nextConfig from 'eslint-config-next'

const config = [
  ...nextConfig,
  {
    rules: {
      'react/no-unescaped-entities': 'off',
      'react-hooks/set-state-in-effect': 'warn',
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
