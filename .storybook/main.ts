import type { StorybookConfig } from '@storybook/nextjs-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  framework: '@storybook/nextjs-vite',
  addons: ['@storybook/addon-themes'],
  staticDirs: ['../public'],
}

export default config
