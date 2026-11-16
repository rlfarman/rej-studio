import { Client, InMemoryTransport } from '@modelcontextprotocol/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A real MCP client talking to the real server over an in-memory transport:
// the tools are exercised the way an agent would, through the protocol, so a
// renamed tool or a changed schema fails here rather than in someone's chat.
//
// Everything below the tools is mocked, because what is under test is the
// surface: which tools exist, what they validate, and what they say when
// something is not there.

;(process.env as Record<string, string>).NODE_ENV = 'development'

const { genes, isoforms, submitted, jobStatus } = vi.hoisted(() => ({
  genes: vi.fn(),
  isoforms: vi.fn(),
  submitted: vi.fn(),
  jobStatus: vi.fn(),
}))

vi.mock('@/features/gene-search/api/gene-queries', () => ({
  fetchGenesBySearch: genes,
  fetchGeneBySymbol: vi.fn(async (symbol: string) =>
    symbol === 'TP53'
      ? { id: 'ENSG00000141510', symbol: 'TP53', name: 'tumor protein p53', species: 'human' }
      : null,
  ),
}))
vi.mock('@/features/gene-search/api/isoform-queries', () => ({
  fetchIsoformsByGene: isoforms,
}))
vi.mock('@/features/design-tool/api/jobs-core', () => ({
  runSubmitJob: submitted,
  runJobStatus: jobStatus,
}))

import { createRejStudioMcpServer } from './server'

/** A short, valid coding sequence: starts ATG, ends TAA, no internal stop. */
const CDS = 'ATG' + 'AAA'.repeat(30) + 'TAA'

async function connect() {
  const server = createRejStudioMcpServer({ name: 'test-agent' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
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
  genes.mockResolvedValue([])
  isoforms.mockResolvedValue([])
  submitted.mockResolvedValue({ jobId: 'job-1' })
  jobStatus.mockResolvedValue({ status: 'not_found' })
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
})

describe('searching genes', () => {
  it('returns the matches as structured data', async () => {
    genes.mockResolvedValue([
      { id: 'ENSG00000141510', symbol: 'TP53', name: 'tumor protein p53', species: 'human' },
    ])

    const result = await call('search_genes', { query: 'p53' })

    expect(result.structuredContent).toEqual({
      results: [
        {
          symbol: 'TP53',
          name: 'tumor protein p53',
          species: 'human',
          ensembl_gene_id: 'ENSG00000141510',
        },
      ],
      total: 1,
    })
  })

  it('says there is no match rather than implying one', async () => {
    const result = await call('search_genes', { query: 'not-a-gene' })

    expect(result.isError).toBe(true)
    expect(said(result)).toContain('No gene matches')
    expect(result.structuredContent).toBeUndefined()
  })

  it('caps how much comes back, and says so', async () => {
    genes.mockResolvedValue(
      Array.from({ length: 40 }, (_, i) => ({
        id: `ENSG${i}`,
        symbol: `GENE${i}`,
        name: 'a gene',
        species: 'human',
      })),
    )

    const result = await call('search_genes', { query: 'gene' })
    const structured = result.structuredContent as {
      results: unknown[]
      total: number
    }

    expect(structured.results).toHaveLength(25)
    expect(structured.total).toBe(40)
    expect(said(result)).toContain('most relevant')
  })

  it('refuses a query the app would refuse, without searching', async () => {
    expect(await call('search_genes', { query: '' })).toMatchObject({
      isError: true,
    })
    expect(await call('search_genes', {})).toMatchObject({ isError: true })
    expect(genes).not.toHaveBeenCalled()
  })
})

describe('reading one gene', () => {
  it('returns the gene with its isoforms', async () => {
    isoforms.mockResolvedValue([
      {
        id: 'ENST00000269305',
        codingSequenceLength: 1182,
        proteinSequenceLength: 393,
        codingSequence: CDS,
        proteinSequence: 'M',
        species: 'human',
      },
    ])

    const result = await call('get_gene', { symbol: 'TP53' })

    expect(result.structuredContent).toMatchObject({
      gene: { symbol: 'TP53', ensembl_gene_id: 'ENSG00000141510' },
      isoforms: [
        {
          ensembl_transcript_id: 'ENST00000269305',
          coding_sequence_length: 1182,
          has_coding_sequence: true,
        },
      ],
    })
  })

  it('says plainly when a symbol is not on record', async () => {
    const result = await call('get_gene', { symbol: 'NOTAGENE' })

    expect(result.isError).toBe(true)
    expect(said(result)).toContain('is on record')
    expect(said(result)).toContain('search_genes')
  })
})

describe('submitting a design', () => {
  it('runs the job and returns its id', async () => {
    const result = await call('submit_design', { name: 'TP53 run', sequence: CDS })

    expect(submitted).toHaveBeenCalledOnce()
    const [params, caller] = submitted.mock.calls[0]
    expect(params.CDS).toBe(CDS)
    expect(params.name).toBe('TP53 run')
    // Rate limited and logged under the token, not globally.
    expect(caller).toEqual({
      key: 'mcp:test-agent',
      label: 'mcp token "test-agent"',
    })
    expect(result.structuredContent).toEqual({
      job_id: 'job-1',
      status: 'running',
    })
  })

  it('passes the options through in the form the backend expects', async () => {
    await call('submit_design', {
      name: 'TP53 run',
      sequence: CDS,
      species: 'human',
      minimize_cpgs: false,
      three_prime_stimulatory_intron: true,
    })

    const [params] = submitted.mock.calls[0]
    expect(params.options).toMatchObject({
      codon_optimize: 'human',
      minimize_CpGs: false,
      stim_3: true,
      stim_5: false,
      remove_cryptic_ss: true,
    })
  })

  it('chooses the same split point the design tool would', async () => {
    await call('submit_design', { name: 'TP53 run', sequence: CDS })

    const [params] = submitted.mock.calls[0]
    expect(params.options.split_point).toBeGreaterThan(0)
    expect(params.options.split_point).toBeLessThan(CDS.length)
  })

  it.each([
    ['a sequence with no start codon', { sequence: 'AAATAA' }],
    ['a sequence that is not whole codons', { sequence: 'ATGAAAT' }],
    ['a sequence with an internal stop', { sequence: 'ATGTAAAAATAA' }],
    ['letters that are not nucleotides', { sequence: 'ATGXYZTAA' }],
    ['a split point past the end', { sequence: CDS, split_point: 99_999 }],
  ])('refuses %s, rather than fixing it', async (_case, overrides) => {
    const result = await call('submit_design', {
      name: 'bad',
      sequence: CDS,
      ...overrides,
    })

    expect(result.isError).toBe(true)
    expect(said(result)).toContain('cannot be run')
    expect(submitted).not.toHaveBeenCalled()
  })

  it('will not reverse-translate a protein without a species to do it with', async () => {
    const result = await call('submit_design', {
      name: 'protein',
      sequence: 'MKVLA',
      sequence_type: 'protein',
    })

    expect(result.isError).toBe(true)
    expect(said(result)).toContain('species')
    expect(submitted).not.toHaveBeenCalled()
  })

  it('reverse-translates a protein when told which species', async () => {
    const result = await call('submit_design', {
      name: 'protein',
      sequence: 'MKVLA',
      sequence_type: 'protein',
      species: 'human',
    })

    expect(result.isError).toBeFalsy()
    const [params] = submitted.mock.calls[0]
    expect(params.CDS).toMatch(/^ATG[ACGT]+$/)
  })

  it('reports a result inline when the backend answered at once', async () => {
    submitted.mockResolvedValue({
      jobId: 'job-2',
      result: { optimized_sequence: CDS },
    })

    const result = await call('submit_design', { name: 'quick', sequence: CDS })

    expect(result.structuredContent).toMatchObject({
      job_id: 'job-2',
      status: 'completed',
    })
  })
})

describe('collecting a design', () => {
  it('returns the result once it is done', async () => {
    jobStatus.mockResolvedValue({
      status: 'completed',
      result: { optimized_sequence: CDS, run_record: { record_version: 1 } },
    })

    const result = await call('get_design', { job_id: 'job-1' })

    expect(result.structuredContent).toMatchObject({
      job_id: 'job-1',
      status: 'completed',
      result: { run_record: { record_version: 1 } },
    })
  })

  it('reports progress while it is still running', async () => {
    jobStatus.mockResolvedValue({
      status: 'running',
      progress: 0.45,
      stage: 'Optimizing sequence',
    })

    const result = await call('get_design', { job_id: 'job-1' })

    expect(result.isError).toBeFalsy()
    expect(said(result)).toContain('Optimizing sequence')
    expect(result.structuredContent).toMatchObject({ progress: 0.45 })
  })

  it('says plainly when there is no such job', async () => {
    const result = await call('get_design', { job_id: 'nope' })

    expect(result.isError).toBe(true)
    expect(said(result)).toContain('No design with job id')
  })

  it('reports a failure as a failure', async () => {
    jobStatus.mockResolvedValue({
      status: 'failed',
      error: { code: 'algo', message: 'optimization failed', retriable: false },
    })

    const result = await call('get_design', { job_id: 'job-1' })

    expect(result.isError).toBe(true)
    expect(said(result)).toContain('optimization failed')
  })
})
