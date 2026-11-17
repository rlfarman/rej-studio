import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from '@modelcontextprotocol/ext-apps/server'
import { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import type { FormValues } from '@/features/design-tool/types/form-schema'
import {
  CLOUD_DESIGN_MAX_BASES,
  estimateCloudSeconds,
  isCloudDesignId,
} from '@/features/design-tool/types/cloud-design'
import { buildJobParams } from '@/features/design-tool/utils/form-handler'
import { searchCorpus } from '@/features/gene-search/corpus/client'
import type { GeneCorpus } from '@/features/gene-search/corpus/client'
import { SEARCH_LIMITS } from '@/features/gene-search/types/search'
import { createLogger } from '@/lib/logger'

import { withinDesignBudget } from '../designs/rate-limit'
import { readCloudDesign, submitCloudDesign } from '../designs/service'
import type { ServerEnv } from '../env'
import { mcpCopy } from './copy'
import { designInput, toFormValues, type DesignInput } from './design-input'
import { designOnWorker, reverseTranslateOnWorker } from './optimizer'
import { withinBudget } from './rate-limit'
import type { McpToken } from './tokens'
import { designViewHtml } from './ui/design-view'

/**
 * REJ Studio for an agent.
 *
 * The tools here are the things a person can already do in the browser, and
 * nothing else: search genes, read a gene and its isoforms, run a design.
 * Each one goes through the same corpus code the pages read and the same
 * validation the form uses, so there is one definition of a valid design and
 * one ranking of a search, not two that can drift.
 *
 * A design up to 12 kb runs inline, in this Worker, on the same WebAssembly
 * module the browser runs: `submit_design` returns the finished design in its
 * own call. A longer one, up to the cloud cap, is handed to the cloud-design
 * Workflow (src/server/designs/) and read back with `get_design`.
 */

const log = createLogger('mcp')

/** The view a finished design is shown in, in hosts that support MCP Apps. */
const DESIGN_VIEW_URI = 'ui://rej-studio/design-result.html'

/** Search results are capped so a tool call cannot return a wall of genes. */
const MAX_SEARCH_RESULTS = SEARCH_LIMITS.page

/**
 * The longest coding sequence `submit_design` designs inline, in the call.
 *
 * Not a Cloudflare limit — a Worker on the Paid plan gets 5 minutes of CPU.
 * It is the MCP client's own request timeout: the design holds the request
 * open, and a client that gives up mid-run leaves the caller with nothing.
 *
 * Measured with the committed `.wasm` (scaling is roughly quadratic):
 * 1.2 kb 0.2 s, 3 kb 1.2 s, 6 kb 4.8 s, 9 kb 11.7 s, **12 kb 21 s**,
 * 15 kb 32 s, 18 kb 48 s. 12,000 bases keeps a run around 20 seconds — well
 * inside a 60-second client timeout and the Worker's CPU budget, with room
 * for a slower isolate — and still covers the largest coding sequence in the
 * gene data (BRCA2, 10,257 bases). Longer sequences, up to
 * `CLOUD_DESIGN_MAX_BASES`, are handed to the cloud-design Workflow instead,
 * so the agent gets a job id in the call and the result from `get_design`.
 */
export const MAX_DESIGN_LENGTH = 12_000

const speciesFilter = z
  .enum(['human', 'mouse', 'both'])
  .describe(mcpCopy.searchGenes.species)

/** A tool result that is plain text and nothing else. */
function text(body: string) {
  return { content: [{ type: 'text' as const, text: body }] }
}

/** A tool result carrying structured data, with a readable summary beside it. */
function data(summary: string, structured: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text: summary }],
    structuredContent: structured,
  }
}

/**
 * Says plainly that something is not there. Agents otherwise fill a silence
 * with a guess, so the wording leaves no room for one.
 */
function notFound(what: string) {
  return { ...text(what), isError: true as const }
}

function failed(summary: string, structured: Record<string, unknown>) {
  return { ...data(summary, structured), isError: true as const }
}

/** Every Zod complaint, in one line an agent can act on. */
function explainValidation(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues
      .map((issue) => {
        const where = issue.path.join('.')
        return where ? `${where}: ${issue.message}` : issue.message
      })
      .join('; ')
  }
  return error instanceof Error ? error.message : String(error)
}

export interface McpServerContext {
  /** The caller, for logging and its rate-limit budget. */
  token: McpToken
  /** The Worker's bindings: the rate limiters. */
  env: ServerEnv
  /** The gene data, read the same way the pages read it. */
  corpus: GeneCorpus
  /**
   * Where the view loads the MCP Apps client from, taken from the request's
   * own origin, and the only origin the view's policy allows.
   */
  bridgeUrl: string
}

export function createRejStudioMcpServer({
  token,
  env,
  corpus,
  bridgeUrl,
}: McpServerContext): McpServer {
  const server = new McpServer(
    { name: 'com.rej-studio/design', version: '1.0.0' },
    { instructions: mcpCopy.instructions },
  )

  /**
   * Spends one unit of this token's budget, or refuses.
   *
   * The message matters as much as the limit: an agent told "no" without a
   * reason retries immediately, and one told "not found" gives up on work
   * that was never done.
   */
  async function overBudget(budget: 'reads' | 'designs', what: string) {
    if (await withinBudget(env, budget, token.name)) return null
    return { ...text(mcpCopy.rateLimited(what)), isError: true as const }
  }

  server.registerTool(
    'search_genes',
    {
      title: mcpCopy.searchGenes.title,
      description: mcpCopy.searchGenes.description,
      inputSchema: z.object({
        query: z.string().min(1).max(200).describe(mcpCopy.searchGenes.query),
        species: speciesFilter.optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ query, species }) => {
      const refused = await overBudget('reads', 'searches')
      if (refused) return refused

      const { results, truncated, suggestions } = await searchCorpus(corpus, {
        q: query,
        species: species ?? 'both',
        limit: MAX_SEARCH_RESULTS,
      })
      log.info('mcp search_genes', {
        caller: token.name,
        resultCount: results.length,
        truncated,
      })

      if (results.length === 0) {
        return notFound(
          mcpCopy.searchGenes.none(
            query,
            suggestions.map((gene) => gene.symbol),
          ),
        )
      }

      return data(mcpCopy.searchGenes.found(results.length, query, truncated), {
        results: results.map((gene) => ({
          symbol: gene.symbol,
          name: gene.name,
          species: gene.species,
          ensembl_gene_id: gene.id,
        })),
        truncated,
      })
    },
  )

  server.registerTool(
    'get_gene',
    {
      title: mcpCopy.getGene.title,
      description: mcpCopy.getGene.description,
      inputSchema: z.object({
        symbol: z.string().min(1).max(100).describe(mcpCopy.getGene.symbol),
        species: z.enum(['human', 'mouse']).optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ symbol, species }) => {
      const refused = await overBudget('reads', 'gene lookups')
      if (refused) return refused

      // One small symbol shard, not the whole index (format.ts).
      const gene = await corpus.geneBySymbol(symbol.trim(), species)
      const file = gene ? await corpus.geneFile(gene.id) : null
      if (!gene || !file) {
        return notFound(mcpCopy.getGene.none(symbol, species))
      }

      return data(
        mcpCopy.getGene.found(
          gene.symbol,
          gene.species,
          gene.name,
          file.isoforms.length,
        ),
        {
          gene: {
            symbol: gene.symbol,
            name: gene.name,
            species: gene.species,
            ensembl_gene_id: gene.id,
          },
          isoforms: file.isoforms.map((isoform) => ({
            ensembl_transcript_id: isoform.id,
            coding_sequence_length: isoform.codingSequenceLength,
            protein_length: isoform.proteinSequenceLength,
            has_coding_sequence: isoform.codingSequence.length > 0,
          })),
        },
      )
    },
  )

  const submitDesign = async (input: DesignInput) => {
    // The length guard comes before validation and before the budget: it is
    // about the request's own shape, and it costs nothing to say.
    const presented = input.sequence.trim()
    const bases =
      (input.sequence_type ?? 'dna') === 'protein'
        ? presented.length * 3
        : presented.length
    if (bases > CLOUD_DESIGN_MAX_BASES) {
      return {
        ...text(mcpCopy.submitDesign.tooLong(bases, CLOUD_DESIGN_MAX_BASES)),
        isError: true as const,
      }
    }

    let values: FormValues
    try {
      values = await toFormValues(input, reverseTranslateOnWorker)
    } catch (error) {
      return {
        ...text(mcpCopy.submitDesign.invalid(explainValidation(error))),
        isError: true as const,
      }
    }

    // Measured on the coding sequence itself, which for protein input is the
    // reverse translation: that is what the optimizer's time depends on.
    if (values.codingSequence.length > MAX_DESIGN_LENGTH) {
      return handOff(values, input.seed)
    }

    const refused = await overBudget('designs', 'designs')
    if (refused) return refused

    const params = buildJobParams(values)
    const outcome = await designOnWorker(
      input.seed === undefined
        ? params
        : { ...params, options: { ...params.options, seed: input.seed } },
    )

    if (!outcome.ok) {
      log.error('mcp submit_design failed', undefined, {
        caller: token.name,
        code: outcome.code,
      })
      return failed(mcpCopy.submitDesign.failed(values.name, outcome.message), {
        name: values.name,
        status: 'failed',
        error: { code: outcome.code, message: outcome.message },
      })
    }

    log.info('mcp submit_design', {
      caller: token.name,
      bases: values.codingSequence.length,
      seconds: outcome.seconds,
    })

    return data(mcpCopy.submitDesign.done(values.name, outcome.seconds), {
      name: values.name,
      status: 'completed',
      result: outcome.result,
    })
  }

  /**
   * A design too long to run in the call goes to the cloud-design Workflow,
   * the same one the web app's "Run in the cloud" uses, owned by this token.
   * An identical request already in the cloud is answered from there: if it
   * has finished, with the result, as an inline design would be.
   */
  const handOff = async (values: FormValues, seed: number | undefined) => {
    const owner = `mcp:${token.name}`
    const outcome = await submitCloudDesign(env, {
      values,
      seed,
      owner,
      spend: () => withinDesignBudget(env, owner),
    })
    if (!outcome.ok) {
      return {
        ...text(
          outcome.reason === 'rate_limited'
            ? mcpCopy.rateLimited('cloud designs')
            : outcome.reason === 'unavailable'
              ? mcpCopy.submitDesign.cloudUnavailable(
                  values.codingSequence.length,
                  MAX_DESIGN_LENGTH,
                )
              : outcome.message,
        ),
        isError: true as const,
      }
    }
    log.info('mcp submit_design handed off', {
      caller: token.name,
      bases: values.codingSequence.length,
      id: outcome.id,
      existing: outcome.existing,
    })
    if (outcome.status === 'completed' || outcome.status === 'failed') {
      return cloudDesignResult(outcome.id)
    }
    const seconds = estimateCloudSeconds(values.codingSequence.length)
    return data(mcpCopy.submitDesign.queued(values.name, outcome.id, seconds), {
      job_id: outcome.id,
      name: values.name,
      status: outcome.status,
      estimated_seconds: seconds,
    })
  }

  /** A cloud design, as submit_design (hand-off) and get_design report it. */
  const cloudDesignResult = async (id: string) => {
    const design = await readCloudDesign(env, id)
    if (!design) return notFound(mcpCopy.getDesign.none(id))
    const name = design.name ?? id
    if (design.status === 'completed' && design.result) {
      return data(mcpCopy.getDesign.done(name), {
        job_id: id,
        name,
        status: 'completed',
        result: design.result,
      })
    }
    if (design.status === 'failed') {
      const error = design.error ?? {
        code: 'unknown',
        message: 'the design failed',
        retriable: true,
      }
      return failed(mcpCopy.getDesign.failed(name, error.message), {
        job_id: id,
        name,
        status: 'failed',
        error: { code: error.code, message: error.message },
      })
    }
    const seconds =
      design.bases === undefined ? null : estimateCloudSeconds(design.bases)
    return data(mcpCopy.getDesign.pending(id, design.status, seconds), {
      job_id: id,
      name,
      status: design.status,
      ...(seconds === null ? {} : { estimated_seconds: seconds }),
    })
  }

  // The view travels with the design, so it has to be registered on the tools
  // that return one. A host that cannot show a view gets the structured
  // result instead, which this tool returns either way.
  registerAppTool(
    server,
    'submit_design',
    {
      title: mcpCopy.submitDesign.title,
      description: mcpCopy.submitDesign.description,
      inputSchema: designInput,
      // Deterministic given the sequence, options and seed, but every call
      // spends the same seconds of compute, so a retry is never free.
      annotations: { readOnlyHint: false, idempotentHint: false },
      _meta: { ui: { resourceUri: DESIGN_VIEW_URI } },
    },
    submitDesign,
  )

  registerAppResource(
    server,
    mcpCopy.designView.name,
    DESIGN_VIEW_URI,
    { description: mcpCopy.designView.description },
    () => ({
      contents: [
        {
          uri: DESIGN_VIEW_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: designViewHtml(bridgeUrl),
          _meta: {
            ui: {
              // The one script the view loads. Nothing else is fetched.
              csp: { resourceDomains: [new URL(bridgeUrl).origin] },
            },
          },
        },
      ],
    }),
  )

  // Reads a cloud design by id: one submit_design handed off, or one the web
  // app ran in the cloud. Ids are request hashes, so reading one needs no
  // ownership check (src/server/designs/service.ts, "Who may do what").
  registerAppTool(
    server,
    'get_design',
    {
      title: mcpCopy.getDesign.title,
      description: mcpCopy.getDesign.description,
      inputSchema: z.object({
        job_id: z.string().min(1).max(200).describe(mcpCopy.getDesign.jobId),
      }),
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: DESIGN_VIEW_URI } },
    },
    async ({ job_id }) => {
      const refused = await overBudget('reads', 'design lookups')
      if (refused) return refused
      const id = job_id.trim()
      if (!isCloudDesignId(id)) return notFound(mcpCopy.getDesign.none(id))
      return cloudDesignResult(id)
    },
  )

  return server
}
