import { readFile } from 'node:fs/promises'
import { source } from '@/lib/source'

/**
 * /llms-full.txt — every /docs page concatenated into one markdown file.
 *
 * Companion to /llms.txt: where that file is a link index, this one
 * contains the full text of every page so tools that prefer one-shot
 * ingestion (rather than crawling link-by-link) can slurp the whole
 * docs site in a single request.
 *
 * Implementation: we re-read the raw MDX files from disk (via
 * `page.absolutePath`) rather than going through the compiled MDX
 * body, so the output is clean markdown without JSX wrappers.
 */
export async function GET() {
  const pages = source.getPages()

  const sections = await Promise.all(
    pages.map(async (page) => {
      const title = page.data.title ?? page.url
      const header = `# ${title}\n\n> Source: ${page.url}\n`

      if (!page.absolutePath) return `${header}\n`

      try {
        const raw = await readFile(page.absolutePath, 'utf8')
        // Strip frontmatter so the output is pure markdown body.
        const body = raw.replace(/^---\n[\s\S]*?\n---\n?/, '').trimStart()
        return `${header}\n${body}\n`
      } catch {
        return `${header}\n`
      }
    }),
  )

  const intro = [
    '# REJ Studio Documentation',
    '',
    'Full-text export of every page under /docs, concatenated into a',
    'single markdown document for LLM ingestion. See /llms.txt for a',
    'link-only index in the llms.txt convention.',
    '',
    '---',
    '',
  ].join('\n')

  const body = intro + sections.join('\n---\n\n')

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control':
        'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
