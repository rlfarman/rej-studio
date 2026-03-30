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
    files: ['*.config.mjs'],
    rules: {
      'import/no-anonymous-default-export': 'off',
    },
  },
]

export default config
