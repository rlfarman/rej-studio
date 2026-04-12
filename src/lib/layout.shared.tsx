import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: 'REJ Studio Docs',
      url: '/docs',
    },
    githubUrl: 'https://github.com/rlfarman/rej-studio',
  }
}
