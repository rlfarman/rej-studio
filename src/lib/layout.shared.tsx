import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'
import { env } from '@/lib/env'

export function baseOptions(): BaseLayoutProps {
  const { NEXT_PUBLIC_GITHUB_OWNER: owner, NEXT_PUBLIC_GITHUB_REPO: repo } = env
  const githubUrl =
    owner && repo ? `https://github.com/${owner}/${repo}` : undefined

  return {
    nav: {
      title: 'REJ Studio Docs',
      url: '/docs',
    },
    ...(githubUrl && { githubUrl }),
  }
}
