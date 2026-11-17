import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  framework: '@storybook/react-vite',
  core: {
    builder: {
      name: '@storybook/builder-vite',
      // Not the app's vite.config.ts: that one runs the Worker (Cloudflare
      // plugin) and TanStack Start, which a story bundle has no use for.
      options: { viteConfigPath: '.storybook/vite.config.ts' },
    },
  },
  addons: ['@storybook/addon-themes'],
  staticDirs: ['../public'],
}

export default config
