import { source } from '@/lib/source'
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/page'
import { notFound } from 'next/navigation'
import { getMDXComponents } from '@/components/mdx'
import type { Metadata } from 'next'
import { createRelativeLink } from 'fumadocs-ui/mdx'
import { execSync } from 'node:child_process'
import { env } from '@/lib/env'

function getGitLastModified(relativePath: string): Date | undefined {
  try {
    const iso = execSync(`git log -1 --format=%cI -- "${relativePath}"`, {
      encoding: 'utf8',
    }).trim()
    return iso ? new Date(iso) : undefined
  } catch {
    return undefined
  }
}

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>
}) {
  const params = await props.params
  const page = source.getPage(params.slug)
  if (!page) notFound()

  const MDX = page.data.body
  const sourcePath = page.path ? `content/docs/${page.path}` : undefined
  const lastUpdate = sourcePath ? getGitLastModified(sourcePath) : undefined

  const owner = env.NEXT_PUBLIC_GITHUB_OWNER
  const repo = env.NEXT_PUBLIC_GITHUB_REPO
  const branch = env.NEXT_PUBLIC_GITHUB_BRANCH ?? 'main'
  const canEdit = Boolean(sourcePath && owner && repo)

  return (
    <DocsPage
      toc={page.data.toc}
      full={page.data.full}
      lastUpdate={lastUpdate}
      editOnGithub={
        canEdit
          ? {
              owner: owner!,
              repo: repo!,
              sha: branch,
              path: sourcePath!,
            }
          : undefined
      }
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  )
}

export function generateStaticParams() {
  return source.generateParams()
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>
}): Promise<Metadata> {
  const params = await props.params
  const page = source.getPage(params.slug)
  if (!page) notFound()

  return {
    title: page.data.title,
    description: page.data.description,
  }
}
