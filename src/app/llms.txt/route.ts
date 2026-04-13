import { llms } from 'fumadocs-core/source'
import { source } from '@/lib/source'

/**
 * /llms.txt — markdown index of the /docs site for LLM ingestion.
 *
 * Follows the llms.txt convention (https://llmstxt.org/): a single
 * markdown document with one link per page, so tools like Claude Code,
 * Cursor, and ChatGPT can crawl the docs structure. For full page
 * contents, see /llms-full.txt.
 */
export function GET() {
  const body = llms(source).index()
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control':
        'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
