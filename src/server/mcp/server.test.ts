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

import { CLOUD_DESIGN_MAX_BASES } from '@/features/design-tool/types/cloud-design'

import type { ServerEnv } from '../env'
import { FakeWorkflow } from '../designs/test-utils'
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

/** The cloud-design Workflow a hand-off goes to, fresh for every test. */
let workflow: FakeWorkflow
let serverEnv: ServerEnv

async function connect() {
  const server = createRejStudioMcpServer({
    token: { name: 'test-agent' },
    env: serverEnv,
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
  workflow = new FakeWorkflow()
  serverEnv = { DESIGN_WORKFLOW: workflow.binding() }
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

  // Two paths, by length, and the descriptions have to say exactly when each
  // happens: an agent told "nothing to poll" waits forever on a job id, and
  // one told to poll polls designs that came back inline.
  it('says when a design comes back in the call and when it needs get_design', async () => {
    const { tools } = await connection.client.listTools()
    const submit = tools.find((tool) => tool.name === 'submit_design')
    const get = tools.find((tool) => tool.name === 'get_design')

    expect(submit?.description).toContain('up to 12,000 bases')
    expect(submit?.description).toContain('returned in it')
    expect(submit?.description).toContain('From 12,001 to 45,000 bases')
    expect(submit?.description).toContain('call get_design with that job_id')
    expect(get?.description).toContain('12,000 bases or fewer')
    expect(submit?.annotations).toMatchObject({ idempotentHint: false })
  })

  // Agents work inside their own harness: nothing may send them to a page.
  it('never tells an agent to open the web app', async () => {
    const { tools } = await connection.client.listTools()
    for (const tool of tools) {
      expect(tool.description).not.toMatch(/open the web app|in the web app/i)
    }
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
  const tooLong = `ATG${'AAA'.repeat(CLOUD_DESIGN_MAX_BASES / 3)}TAA`

  it('refuses a sequence longer than any design runs here', async () => {
    const result = await call('submit_design', {
      name: 'huge',
      sequence: tooLong,
    })

    expect(result.isError).toBe(true)
    expect(said(result)).toContain(CLOUD_DESIGN_MAX_BASES.toLocaleString())
    expect(design).not.toHaveBeenCalled()
    expect(workflow.creates).toBe(0)
  })

  // The refusal has to leave the caller something to do in the
  // conversation, never a page to open.
  it('says what to do instead, inside the conversation', async () => {
    const result = await call('submit_design', {
      name: 'huge',
      sequence: tooLong,
    })

    expect(said(result)).toMatch(/split it into shorter coding sequences/i)
    expect(said(result)).not.toContain('web app')
  })

  it('counts a protein as the DNA it becomes', async () => {
    const result = await call('submit_design', {
      name: 'huge protein',
      sequence: 'M'.repeat(CLOUD_DESIGN_MAX_BASES / 3 + 1),
      sequence_type: 'protein',
      species: 'human',
    })

    expect(result.isError).toBe(true)
    expect(said(result)).toContain('bases')
    expect(reverseTranslate).not.toHaveBeenCalled()
  })

  it('designs a sequence just inside the inline limit in the call', async () => {
    const result = await call('submit_design', {
      name: 'large',
      sequence: `ATG${'AAA'.repeat(MAX_DESIGN_LENGTH / 3 - 2)}TAA`,
    })

    expect(result.isError).toBeFalsy()
    expect(design).toHaveBeenCalledOnce()
    expect(workflow.creates).toBe(0)
  })
})

describe('a design too long for the call', () => {
  // Over the inline limit, under the cloud cap.
  const long = `ATG${'AAA'.repeat(MAX_DESIGN_LENGTH / 3)}TAA`

  it('is handed to the cloud, owned by the token, and answered with a job id', async () => {
    const result = await call('submit_design', { name: 'long', sequence: long })

    expect(result.isError).toBeFalsy()
    expect(design).not.toHaveBeenCalled()
    const structured = result.structuredContent as Record<string, unknown>
    expect(structured).toMatchObject({ name: 'long', status: 'queued' })
    expect(structured.job_id).toMatch(/^[0-9a-f]{64}$/)
    expect(structured.estimated_seconds).toBeGreaterThan(0)
    expect(said(result)).toContain('get_design')

    const instance = workflow.instances.get(structured.job_id as string)
    expect(instance?.params.owner).toBe('mcp:test-agent')
    expect(instance?.params.bases).toBe(long.length)
  })

  it('hands the same request to the same job rather than running it twice', async () => {
    const first = await call('submit_design', { name: 'long', sequence: long })
    const second = await call('submit_design', { name: 'long', sequence: long })

    expect(second.structuredContent).toMatchObject({
      job_id: (first.structuredContent as { job_id: string }).job_id,
    })
    expect(workflow.creates).toBe(1)
  })

  it('is read back with get_design: running, then the result', async () => {
    const submitted = await call('submit_design', {
      name: 'long',
      sequence: long,
    })
    const jobId = (submitted.structuredContent as { job_id: string }).job_id
    const instance = workflow.instances.get(jobId)!

    instance.snapshot = { status: 'running' }
    const running = await call('get_design', { job_id: jobId })
    expect(running.isError).toBeFalsy()
    expect(running.structuredContent).toMatchObject({
      job_id: jobId,
      status: 'running',
      name: 'long',
    })
    expect(said(running)).toContain('call get_design again')

    const { values, owner, bases, submittedAt } = instance.params
    instance.snapshot = {
      status: 'complete',
      output: {
        values,
        owner,
        bases,
        submittedAt,
        seconds: 30,
        result: RESULT,
      },
    }
    const done = await call('get_design', { job_id: jobId })
    expect(done.isError).toBeFalsy()
    expect(done.structuredContent).toMatchObject({
      job_id: jobId,
      status: 'completed',
      result: { optimized_sequence: RESULT.optimized_sequence },
    })
  })

  it('reports a cloud design that ran out of CPU as failed, with the reason', async () => {
    const submitted = await call('submit_design', {
      name: 'long',
      sequence: long,
    })
    const jobId = (submitted.structuredContent as { job_id: string }).job_id
    workflow.instances.get(jobId)!.snapshot = {
      status: 'errored',
      error: { name: 'Error', message: 'Worker exceeded CPU time limit.' },
    }

    const result = await call('get_design', { job_id: jobId })
    expect(result.isError).toBe(true)
    expect(result.structuredContent).toMatchObject({
      status: 'failed',
      error: { code: 'too_large' },
    })
  })

  it('says so plainly when this deployment has no cloud designs', async () => {
    serverEnv = {}
    await connection.close()
    connection = await connect()

    const result = await call('submit_design', { name: 'long', sequence: long })
    expect(result.isError).toBe(true)
    expect(said(result)).toContain(MAX_DESIGN_LENGTH.toLocaleString())
    expect(design).not.toHaveBeenCalled()
  })
})

describe('the design a view is shown in', () => {
  it('attaches the view to the tools that return a design', async () => {
    const { tools } = await connection.client.listTools()
    for (const name of ['submit_design', 'get_design']) {
      expect(tools.find((tool) => tool.name === name)?._meta).toMatchObject({
        ui: { resourceUri: 'ui://rej-studio/design-result.html' },
      })
    }
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
  // An id from an older version of the endpoint, or a made-up one: a plain
  // "not found" that says where ids come from, not an unknown-tool error.
  it('says plainly that an unknown id is not there, and where ids come from', async () => {
    for (const jobId of ['job-1', 'f'.repeat(64)]) {
      const result = await call('get_design', { job_id: jobId })

      expect(result.isError).toBe(true)
      expect(said(result)).toContain('no cloud design')
      expect(said(result)).toContain('submit_design')
    }
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
