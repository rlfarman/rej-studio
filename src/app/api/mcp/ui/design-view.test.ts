import { beforeEach, describe, expect, it } from 'vitest'

import { designViewHtml } from './design-view'

/**
 * The view, actually run.
 *
 * It is a string of HTML delivered through the protocol, so nothing else in
 * the build type-checks it or renders it — and there is no chat host in CI to
 * notice that it showed the wrong thing. These tests put its document in the
 * DOM, run its script with the client library stubbed, and hand it the tool
 * results a host would hand it.
 */

const BRIDGE = 'https://rej.example.com/mcp/app-bridge.js'

interface ToolResultHandler {
  (result: { structuredContent?: Record<string, unknown> }): void
}

/** Mounts the view and returns the handler the host would call. */
function mountView(): ToolResultHandler {
  const html = designViewHtml(BRIDGE)
  const body = html.slice(
    html.indexOf('<body>') + '<body>'.length,
    html.indexOf('<script'),
  )
  document.body.innerHTML = body

  const script = html
    .slice(
      html.indexOf('<script type="module">') + '<script type="module">'.length,
      html.lastIndexOf('</script>'),
    )
    // The one import the view makes. In a host this is the MCP Apps client;
    // here it only has to accept a handler and a connect() call.
    .replace(/import \{ App \} from "[^"]*";/, '')

  let handler: ToolResultHandler | undefined
  class AppStub {
    set ontoolresult(next: ToolResultHandler) {
      handler = next
    }
    connect() {}
  }

  // The view's own script, run as the host runs it. Evaluating that string is
  // the point of this test: the view ships as one inline module, so there is
  // no file to import.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- runs the view's own inline script, the code under test
  new Function('App', 'document', script)(AppStub, document)

  if (!handler) {
    throw new Error('the view never registered a tool-result handler')
  }
  return handler
}

const summary = () => document.getElementById('summary')?.textContent ?? ''
const hidden = (id: string) =>
  (document.getElementById(id) as HTMLElement | null)?.hidden

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('a finished design', () => {
  it('shows what the design did', () => {
    const onToolResult = mountView()

    onToolResult({
      structuredContent: {
        job_id: 'job-1',
        status: 'completed',
        result: {
          name: 'TP53 run',
          original_sequence: 'ATG'.repeat(100),
          seq5: 'ATG'.repeat(50),
          seq3: 'ATG'.repeat(50),
          split_point: 150,
          optimized_sequence: 'ATG'.repeat(100),
          processing_time_seconds: 4.2,
          objectives_report_before: {
            entries: [{ objective: 'AvoidPattern', passes: false }],
          },
          objectives_report_after: {
            entries: [{ objective: 'AvoidPattern', passes: true }],
          },
        },
      },
    })

    expect(document.getElementById('name')?.textContent).toBe('TP53 run')
    expect(summary()).toContain('300 nt optimized and split')
    expect(document.getElementById('sequence')?.textContent).toContain('ATG')
    expect(document.getElementById('objectives-body')?.textContent).toContain(
      'failed → passed',
    )
  })
})

describe('a design with no result yet', () => {
  // The view is attached to every get_design call, not only the ones that
  // finished. Leaving "Waiting for the result…" under a host that has just
  // said the design failed is the failure these cover.
  it('says a failed design failed, and why', () => {
    const onToolResult = mountView()

    onToolResult({
      structuredContent: {
        job_id: 'job-2',
        status: 'failed',
        error: { message: 'impossible constraints' },
      },
    })

    expect(summary()).toContain('did not finish')
    expect(summary()).toContain('impossible constraints')
    expect(summary()).not.toContain('Waiting')
    expect(hidden('objectives-wrap')).toBe(true)
  })

  it('says a running design is still running, and at what stage', () => {
    const onToolResult = mountView()

    onToolResult({
      structuredContent: {
        job_id: 'job-3',
        status: 'running',
        stage: 'Optimizing',
      },
    })

    expect(summary()).toContain('Still running')
    expect(summary()).toContain('Optimizing')
    expect(summary()).not.toContain('Waiting')
  })

  it('shows nothing rather than guessing when the host sends no payload', () => {
    const onToolResult = mountView()

    onToolResult({})

    expect(summary()).toBe('No design to show.')
  })
})
