import { Client, InMemoryTransport } from '@modelcontextprotocol/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

// A real MCP client talking to the real server over an in-memory transport:
// the tools are exercised the way an agent would, through the protocol, so a
// renamed tool or a changed schema fails here rather than in someone's chat.
//
// The gene data is the committed sample, read from disk, so searches rank
// exactly as they do in the app. The optimizer is mocked here, because its
// module is WebAssembly imported the Cloudflare way and only instantiates in
// workerd: the real thing runs a real design in server.workerd.test.ts.

const { design, reverseTranslate, budget } = vi.hoisted(() => ({
  design: vi.fn(),
  reverseTranslate: vi.fn(),
  /** Flipped by the tests that check what a spent budget says. */
  budget: { ok: true },
}))

vi.mock('./optimizer', () => ({
  designOnWorker: design,
  reverseTranslateOnWorker: reverseTranslate,
}))
vi.mock('./rate-limit', () => ({
  withinBudget: async () => budget.ok,
}))

import { sampleCorpus } from '@/features/gene-search/corpus/test-utils'

import { createRejStudioMcpServer, MAX_DESIGN_LENGTH } from './server'

/** A short, valid coding sequence: starts ATG, ends TAA, no internal stop. */
const CDS = `ATG${'AAA'.repeat(30)}TAA`

/** Enough of a result to satisfy the contract schema the tools return. */
const RESULT = {
  name: 'TP53 run',
  original_sequence: CDS,
  optimized_sequence: CDS,
  seq5: CDS.slice(0, 45),
  seq3: CDS.slice(45),
  split_point: 45,
  used_wggw_as_split: false,
  objectives_before: '',
  objectives_after: '',
  processing_time_seconds: 0,
}

async function connect() {
  const server = createRejStudioMcpServer({
    token: { name: 'test-agent' },
    env: {},
    corpus: sampleCorpus(),
    bridgeUrl: 'https://rej.example.com/mcp/app-bridge.js',
  })
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'test-client', version: '1.0.0' })
  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ])
  return { client, close: () => client.close() }
}

let connection: Awaited<ReturnType<typeof connect>>

beforeEach(async () => {
  vi.clearAllMocks()
  budget.ok = true
  design.mockResolvedValue({ ok: true, result: RESULT, seconds: 0.2 })
  reverseTranslate.mockImplementation(async (protein: string) => ({
    ok: true,
    // Enough to be a valid CDS: one codon per residue, then a stop.
    CDS: `ATG${'AAA'.repeat(protein.length)}TAA`,
  }))
  connection = await connect()
})

afterEach(async () => {
  await connection.close()
})

const call = (name: string, args: Record<string, unknown> = {}) =>
  connection.client.callTool({ name, arguments: args })

const said = (result: Awaited<ReturnType<typeof call>>) =>
  (result.content as { type: string; text?: string }[])
    .map((block) => block.text ?? '')
    .join('\n')

describe('what an agent is offered', () => {
  it('offers exactly the things the app itself does', async () => {
    const { tools } = await connection.client.listTools()

    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'get_design',
      'get_gene',
      'search_genes',
      'submit_design',
    ])
  })

  it('tells a model what each tool returns and when to use it', async () => {
    const { tools } = await connection.client.listTools()

    for (const tool of tools) {
      expect(tool.description?.length ?? 0).toBeGreaterThan(80)
      expect(tool.inputSchema).toBeDefined()
    }
  })

  it('marks the tools that only read', async () => {
    const { tools } = await connection.client.listTools()
    const readOnly = Object.fromEntries(
      tools.map((tool) => [tool.name, tool.annotations?.readOnlyHint]),
    )

    expect(readOnly.search_genes).toBe(true)
    expect(readOnly.get_gene).toBe(true)
    expect(readOnly.get_design).toBe(true)
    expect(readOnly.submit_design).toBe(false)
  })

  // The inline job model: nothing is submitted and collected later, so a
  // description that says otherwise sends an agent looking for a job id.
  it('does not describe designs as jobs to poll for', async () => {
    const { tools } = await connection.client.listTools()
    const submit = tools.find((tool) => tool.name === 'submit_design')

    expect(submit?.description).toContain('in this call')
    expect(submit?.description).toContain('no job to poll')
    expect(submit?.description).not.toMatch(/job id|call get_design/i)
    expect(submit?.annotations).toMatchObject({ idempotentHint: false })
  })
})

describe('searching genes', () => {
  it('returns the matches as structured data', async () => {
    const result = await call('search_genes', { query: 'TP53' })
    const { results } = result.structuredContent as {
      results: { symbol: string; ensembl_gene_id: string }[]
    }

    expect(results[0]).toEqual({
      symbol: 'TP53',
      name: 'Tumor protein p53',
      species: 'human',
      ensembl_gene_id: 'ENSG00000141510',
    })
  })

  it('finds a gene by its name, as the app does', async () => {
    const result = await call('search_genes', { query: 'tumor protein p53' })
    const { results } = result.structuredContent as {
      results: { symbol: string }[]
    }

    expect(results.map((gene) => gene.symbol)).toContain('TP53')
  })

  it('filters by species', async () => {
    const result = await call('search_genes', {
      query: 'TP53',
      species: 'mouse',
    })
    const { results } = result.structuredContent as {
      results: { species: string }[]
    }

    expect(results.length).toBeGreaterThan(0)
    expect(results.every((gene) => gene.species === 'mouse')).toBe(true)
  })

  it('says there is no match rather than implying one', async () => {
    const result = await call('search_genes', { query: 'not-a-gene-at-all' })

    expect(result.isError).toBe(true)
    expect(said(result)).toContain('No gene matches')
    expect(result.structuredContent).toBeUndefined()
  })

  it('refuses a query the app would refuse, without searching', async () => {
    expect(await call('search_genes', { query: '' })).toMatchObject({
      isError: true,
    })
    expect(await call('search_genes', {})).toMatchObject({ isError: true })
  })
})

describe('reading one gene', () => {
  it('returns the gene with its isoforms', async () => {
    const result = await call('get_gene', { symbol: 'TP53' })
    const structured = result.structuredContent as {
      gene: { symbol: string; ensembl_gene_id: string }
      isoforms: {
        ensembl_transcript_id: string
        coding_sequence_length: number
        has_coding_sequence: boolean
      }[]
    }

    expect(structured.gene).toMatchObject({
      symbol: 'TP53',
      ensembl_gene_id: 'ENSG00000141510',
    })
    expect(structured.isoforms).toContainEqual(
      expect.objectContaining({
        ensembl_transcript_id: 'ENST00000269305',
        coding_sequence_length: 1182,
        has_coding_sequence: true,
      }),
    )
  })

  it('says plainly when a symbol is not on record', async () => {
    const result = await call('get_gene', { symbol: 'NOTAGENE' })

    expect(result.isError).toBe(true)
    expect(said(result)).toContain('is on record')
    expect(said(result)).toContain('search_genes')
  })
})

describe('running a design', () => {
  it('returns the finished design, with nothing to poll for', async () => {
    const result = await call('submit_design', {
      name: 'TP53 run',
      sequence: CDS,
    })

    expect(design).toHaveBeenCalledOnce()
    const [params] = design.mock.calls[0]
    expect(params.CDS).toBe(CDS)
    expect(params.name).toBe('TP53 run')
    expect(result.structuredContent).toMatchObject({
      name: 'TP53 run',
      status: 'completed',
      result: { optimized_sequence: CDS },
    })
    expect(said(result)).toContain('nothing to poll for')
  })

  it('passes the options through in the form the optimizer expects', async () => {
    await call('submit_design', {
      name: 'TP53 run',
      sequence: CDS,
      species: 'human',
      minimize_cpgs: false,
      three_prime_stimulatory_intron: true,
    })

    const [params] = design.mock.calls[0]
    expect(params.options).toMatchObject({
      codon_optimize: 'human',
      minimize_CpGs: false,
      stim_3: true,
      stim_5: false,
      remove_cryptic_ss: true,
    })
  })

  it('passes a seed through, for a reproducible design', async () => {
    await call('submit_design', { name: 'seeded', sequence: CDS, seed: 99 })

    expect(design.mock.calls[0][0].options.seed).toBe(99)
  })

  it('chooses the same split point the design tool would', async () => {
    await call('submit_design', { name: 'TP53 run', sequence: CDS })

    const [params] = design.mock.calls[0]
    expect(params.options.split_point).toBeGreaterThan(0)
    expect(params.options.split_point).toBeLessThan(CDS.length)
  })

  it.each([
    ['a sequence with no start codon', { sequence: 'AAATAA' }],
    ['a sequence that is not whole codons', { sequence: 'ATGAAAT' }],
    ['a sequence with an internal stop', { sequence: 'ATGTAAAAATAA' }],
    ['letters that are not nucleotides', { sequence: 'ATGXYZTAA' }],
    ['a split point past the end', { sequence: CDS, split_point: 99_999 }],
  ])('refuses %s, rather than fixing it', async (_case, args) => {
    const result = await call('submit_design', { name: 'bad', ...args })

    expect(result.isError).toBe(true)
    expect(said(result)).toContain('cannot be run')
    expect(design).not.toHaveBeenCalled()
  })

  it('will not reverse-translate a protein without a species to do it with', async () => {
    const result = await call('submit_design', {
      name: 'protein',
      sequence: 'MKVLA',
      sequence_type: 'protein',
    })

    expect(result.isError).toBe(true)
    expect(said(result)).toContain('species')
    expect(design).not.toHaveBeenCalled()
  })

  it('reverse-translates a protein in the optimizer when told which species', async () => {
    const result = await call('submit_design', {
      name: 'protein',
      sequence: 'MKVLA',
      sequence_type: 'protein',
      species: 'human',
    })

    expect(result.isError).toBeFalsy()
    expect(reverseTranslate).toHaveBeenCalledWith('MKVLA', 'human')
    expect(design.mock.calls[0][0].CDS).toMatch(/^ATG[ACGT]+$/)
  })

  it('reports a failure as a failure, not as a design', async () => {
    design.mockResolvedValue({
      ok: false,
      code: 'backend',
      message: 'the optimizer failed',
    })

    const result = await call('submit_design', { name: 'nope', sequence: CDS })

    expect(result.isError).toBe(true)
    expect(said(result)).toContain('the optimizer failed')
    expect(result.structuredContent).not.toHaveProperty('result')
  })
})

describe('the sequence-length guard', () => {
  const tooLong = `ATG${'AAA'.repeat(MAX_DESIGN_LENGTH / 3)}TAA`

  it('refuses a sequence too long to design inside one request', async () => {
    const result = await call('submit_design', {
      name: 'huge',
      sequence: tooLong,
    })

    expect(result.isError).toBe(true)
    expect(said(result)).toContain(MAX_DESIGN_LENGTH.toLocaleString())
    expect(design).not.toHaveBeenCalled()
  })

  // The refusal has to leave the caller somewhere to go: the same optimizer
  // runs in the browser with no request waiting on it.
  it('points at the web app rather than just saying no', async () => {
    const result = await call('submit_design', {
      name: 'huge',
      sequence: tooLong,
    })

    expect(said(result)).toContain('web app')
  })

  it('counts a protein as the DNA it becomes', async () => {
    const result = await call('submit_design', {
      name: 'huge protein',
      sequence: 'M'.repeat(MAX_DESIGN_LENGTH / 3 + 1),
      sequence_type: 'protein',
      species: 'human',
    })

    expect(result.isError).toBe(true)
    expect(said(result)).toContain('bases')
    expect(reverseTranslate).not.toHaveBeenCalled()
  })

  it('designs a sequence just inside the limit', async () => {
    const result = await call('submit_design', {
      name: 'large',
      sequence: `ATG${'AAA'.repeat(MAX_DESIGN_LENGTH / 3 - 2)}TAA`,
    })

    expect(result.isError).toBeFalsy()
    expect(design).toHaveBeenCalledOnce()
  })
})

describe('the design a view is shown in', () => {
  it('attaches the view to submit_design, which is what returns a design', async () => {
    const { tools } = await connection.client.listTools()
    const submit = tools.find((tool) => tool.name === 'submit_design')

    expect(submit?._meta).toMatchObject({
      ui: { resourceUri: 'ui://rej-studio/design-result.html' },
    })
  })

  it('serves the view as one self-contained document', async () => {
    const { contents } = await connection.client.readResource({
      uri: 'ui://rej-studio/design-result.html',
    })
    const [view] = contents

    expect(view?.mimeType).toBe('text/html;profile=mcp-app')
    const html = String((view as { text?: string } | undefined)?.text)
    expect(html).toContain('<!doctype html>')
    // One script, from this deployment, and nothing else fetched.
    const scripts = html.match(/<script[^>]*src=|import .* from "/g) ?? []
    expect(scripts).toHaveLength(1)
    expect(html).toContain('https://rej.example.com/mcp/app-bridge.js')
  })

  it('allows the view to load that one script, and no other origin', async () => {
    const { contents } = await connection.client.readResource({
      uri: 'ui://rej-studio/design-result.html',
    })

    expect(contents[0]?._meta).toMatchObject({
      ui: { csp: { resourceDomains: ['https://rej.example.com'] } },
    })
  })
})

describe('asking for a design by id', () => {
  // Kept rather than removed, for an agent working from a stale schema. It
  // says what became of the id instead of failing as an unknown tool.
  it('says designs are returned directly, without implying one was lost', async () => {
    const result = await call('get_design', { job_id: 'job-1' })

    expect(result.isError).toBe(true)
    expect(said(result)).toContain('inline')
    expect(said(result)).toContain('submit_design')
  })
})

describe('when a token has spent its budget', () => {
  // Every tool costs something: a search parses gene data, a design burns
  // seconds of CPU. An agent polls in a loop, so each path has to say no in a
  // way that does not send it off to do something worse.
  beforeEach(() => {
    budget.ok = false
  })

  it('refuses a search', async () => {
    const result = await call('search_genes', { query: 'TP53' })

    expect(result.isError).toBe(true)
    expect(said(result)).toContain('Too many searches')
  })

  it('refuses a gene lookup', async () => {
    const result = await call('get_gene', { symbol: 'TP53' })

    expect(result.isError).toBe(true)
    expect(said(result)).toContain('Too many gene lookups')
  })

  it('refuses a design without running one', async () => {
    const result = await call('submit_design', { name: 'nope', sequence: CDS })

    expect(result.isError).toBe(true)
    expect(said(result)).toContain('Too many designs')
    expect(design).not.toHaveBeenCalled()
  })
})
