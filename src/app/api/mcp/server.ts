import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from '@modelcontextprotocol/ext-apps/server'
import { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'

import {
  fetchJobStatus,
  submitToBackend,
} from '@/features/design-tool/api/job-backend'
import {
  type FormValues,
  validationSchema,
} from '@/features/design-tool/types/form-schema'
import { pickDefaultSplitPoint } from '@/features/design-tool/utils/default-split-point'
import {
  listWggwSites,
  pickDefaultWggwSite,
} from '@/features/design-tool/utils/default-wggw-site'
import { buildJobParams } from '@/features/design-tool/utils/form-handler'
import {
  fetchGeneBySymbol,
  fetchGenesBySearch,
} from '@/features/gene-search/api/gene-queries'
import { fetchIsoformsByGene } from '@/features/gene-search/api/isoform-queries'
import { reverseTranslate } from '@/lib/bio/reverse-translate'
import { isSpecies } from '@/lib/bio/species'
import { createLogger } from '@/lib/logger'
import { createUpstashRateLimiter } from '@/lib/upstash'

import type { McpToken } from './tokens'
import { designViewHtml } from './ui/design-view'

/**
 * The view a finished design is shown in, inside hosts that support MCP Apps.
 * Hosts that do not simply ignore the metadata and show the structured result,
 * which `get_design` returns either way.
 */
const DESIGN_VIEW_URI = 'ui://rej-studio/design-result.html'

/**
 * Where the view loads its client library from, and the only origin its
 * content security policy allows. Falls back to a relative path when the
 * deployment has not been told its own URL, which a host may refuse; the
 * view then shows nothing rather than something wrong.
 */
function appOrigin(): string | null {
  const url = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (!url) {
    return null
  }
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/**
 * REJ Studio for an agent.
 *
 * The tools here are the things a signed-in person can already do in the
 * browser, and nothing else: search genes, read a gene and its isoforms,
 * submit a design, read the result. Each one goes through the same validation
 * the form uses and the same job path the UI uses, so there is one definition
 * of what a valid design is, not two that can drift.
 *
 * Descriptions are read by a model deciding what to call, so they say what
 * comes back and when the tool is the right one. Nothing guesses on the
 * caller's behalf: an unknown gene is a plain "not found", and an option the
 * app would reject is an error rather than a value quietly adjusted to fit.
 */

const log = createLogger('mcp')

/** Search results are capped so a tool call cannot return a wall of genes. */
const MAX_SEARCH_RESULTS = 25

const speciesFilter = z
  .enum(['human', 'mouse', 'both'])
  .describe('Which species to search. Defaults to both.')

/** The design options an agent can set. Defaults match the form's. */
const designInput = z.object({
  name: z
    .string()
    .min(1)
    .max(250)
    .describe('A label for this design, used in the result and the export.'),
  sequence: z
    .string()
    .min(1)
    .describe(
      'The coding sequence to optimize. DNA by default: it must start with ATG, ' +
        'end in a stop codon, contain no internal stop, and have a length that is ' +
        'a multiple of three. Set sequence_type to "protein" to pass amino acids instead.',
    ),
  sequence_type: z
    .enum(['dna', 'protein'])
    .optional()
    .describe(
      'Whether `sequence` is DNA or protein. A protein sequence is reverse-translated ' +
        'with the chosen species’ preferred codons before optimization, so species ' +
        'is required for it. Defaults to dna.',
    ),
  species: z
    .enum(['none', 'human', 'mouse'])
    .optional()
    .describe(
      'Whose codon usage to optimize towards. "none" skips codon optimization ' +
        'and is not allowed for protein input. Defaults to none.',
    ),
  split_point: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe(
      'Where the coding sequence is divided into 5′ and 3′ fragments, as a base ' +
        'position. Must be inside the sequence. Defaults to the same position the ' +
        'design tool would choose.',
    ),
  remove_cryptic_splice_sites: z.boolean().optional(),
  minimize_cpgs: z.boolean().optional(),
  reduce_kmer_complexity: z.boolean().optional(),
  enforce_gc_content: z.boolean().optional(),
  five_prime_stimulatory_intron: z.boolean().optional(),
  three_prime_stimulatory_intron: z.boolean().optional(),
})

type DesignInput = z.infer<typeof designInput>

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

/**
 * Turns an agent's design input into the form values the app validates.
 *
 * Protein input is reverse-translated first, exactly as the browser does
 * before submitting, so both routes hand the backend a coding sequence.
 */
function toFormValues(input: DesignInput): FormValues {
  const species = input.species ?? 'none'
  const sequenceType = input.sequence_type ?? 'dna'
  const raw = input.sequence.trim().toUpperCase()

  if (sequenceType === 'protein' && !isSpecies(species)) {
    throw new Error(
      'Protein input needs a species ("human" or "mouse"), because it is reverse-translated before optimization.',
    )
  }

  const codingSequence =
    sequenceType === 'protein' && isSpecies(species)
      ? reverseTranslate(raw, species)
      : raw

  const splitPoint = input.split_point ?? pickDefaultSplitPoint(codingSequence)

  const values = {
    sequenceType,
    codingSequence,
    proteinSequence: sequenceType === 'protein' ? raw : '',
    name: input.name,
    species,
    codonOptimizeWeight: 1,
    removeCrypticSpliceSites: input.remove_cryptic_splice_sites ?? true,
    removeCrypticSpliceSitesWeight: 1,
    minimizeCpgs: input.minimize_cpgs ?? true,
    minimizeCpgsWeight: 1,
    reduceKmerComplexity: input.reduce_kmer_complexity ?? true,
    reduceKmerComplexityWeight: 1,
    enforceGcContent: input.enforce_gc_content ?? true,
    '5PrimeStimulatoryIntron': input.five_prime_stimulatory_intron ?? false,
    '3PrimeStimulatoryIntron': input.three_prime_stimulatory_intron ?? false,
    spliceJunctionPositions: [splitPoint],
    selectedWggwSites: [
      pickDefaultWggwSite(listWggwSites(codingSequence), splitPoint),
    ],
  }

  // The form's own schema has the final word, so an agent cannot submit a
  // design the UI would have refused.
  return validationSchema.parse(values)
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

// The same budget the browser gets, counted per token rather than per
// request: an agent holds one token across many requests, so a per-IP key
// would either throttle a whole lab together or not throttle an agent at all.
const submitLimiter = createUpstashRateLimiter({
  prefix: 'mcp-jobs',
  maxRequests: 10,
  windowMs: 60_000,
})

export function createRejStudioMcpServer(token: McpToken): McpServer {
  const server = new McpServer(
    { name: 'com.rej-studio/design', version: '1.0.0' },
    {
      instructions: [
        'REJ Studio designs coding sequences for RNA end-joining: it optimizes a',
        'sequence and splits it into 5′ and 3′ fragments.',
        '',
        'Use search_genes and get_gene to find a sequence to work from, then',
        'submit_design to optimize it and get_design to collect the result.',
        'A design runs for seconds to minutes, so submit_design returns a job id',
        'and get_design reports progress until it is done.',
        '',
        'These tools do only what the web app does. They will not invent a',
        'sequence, adjust an option to make a design work, or report a gene that',
        'is not in the database.',
      ].join('\n'),
    },
  )

  server.registerTool(
    'search_genes',
    {
      title: 'Search genes',
      description:
        'Finds genes by symbol, name, Ensembl ID (ENSG/ENST) or disease association, ' +
        'ranked by relevance. Returns each match’s symbol, name, species and Ensembl ' +
        'gene ID. Use this when you have a name or a description and need the gene; ' +
        'use get_gene when you already know the exact symbol.',
      inputSchema: z.object({
        query: z.string().min(1).max(200).describe('What to search for.'),
        species: speciesFilter.optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ query, species }) => {
      // The query does the limiting, so the count below is the number of
      // genes actually on offer. `truncated` means more matched than were
      // fetched, which is said outright rather than reported as a total the
      // tool cannot actually produce.
      const { results: matches, truncated } = await fetchGenesBySearch(
        query.trim(),
        species ?? 'both',
        MAX_SEARCH_RESULTS,
      )
      log.info('mcp search_genes', {
        caller: token.name,
        resultCount: matches.length,
        truncated,
      })

      if (matches.length === 0) {
        return notFound(
          `No gene matches "${query}". The database holds human and mouse genes only; it is not a record of every gene that exists.`,
        )
      }

      const results = matches.map((gene) => ({
        symbol: gene.symbol,
        name: gene.name,
        species: gene.species,
        ensembl_gene_id: gene.id,
      }))

      return data(
        `${results.length} gene${results.length === 1 ? '' : 's'} match "${query}"` +
          (truncated
            ? `; more matched than are listed, so narrow the query if the gene you want is missing.`
            : '.'),
        { results, truncated },
      )
    },
  )

  server.registerTool(
    'get_gene',
    {
      title: 'Get a gene and its isoforms',
      description:
        'Returns one gene by its exact symbol, with its transcript isoforms: Ensembl ' +
        'transcript ID, length, and whether a coding sequence is on record. Use this ' +
        'to pick the isoform to design from; its coding sequence is what submit_design ' +
        'takes. Returns not found if the symbol is not in the database.',
      inputSchema: z.object({
        symbol: z
          .string()
          .min(1)
          .max(100)
          .describe('The exact gene symbol, for example TP53.'),
        species: z.enum(['human', 'mouse']).optional(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ symbol, species }) => {
      const gene = await fetchGeneBySymbol(symbol.trim(), species ?? 'both')
      if (!gene) {
        return notFound(
          `No gene with the symbol "${symbol}"${species ? ` in ${species}` : ''} is on record. Try search_genes, which matches names and descriptions too.`,
        )
      }

      const isoforms = await fetchIsoformsByGene(gene.id)
      return data(
        `${gene.symbol} (${gene.species}): ${gene.name}. ${isoforms.length} isoform${isoforms.length === 1 ? '' : 's'}.`,
        {
          gene: {
            symbol: gene.symbol,
            name: gene.name,
            species: gene.species,
            ensembl_gene_id: gene.id,
          },
          isoforms: isoforms.map((isoform) => ({
            ensembl_transcript_id: isoform.id,
            coding_sequence_length: isoform.codingSequenceLength,
            protein_length: isoform.proteinSequenceLength,
            has_coding_sequence: isoform.codingSequence.length > 0,
          })),
        },
      )
    },
  )

  server.registerTool(
    'submit_design',
    {
      title: 'Submit a design',
      description:
        'Starts an optimization and split of a coding sequence, and returns a job id. ' +
        'The design takes seconds to minutes, so call get_design with the id to collect ' +
        'the result. The sequence is validated exactly as the web form validates it; a ' +
        'sequence or option it would refuse is an error here too, not something adjusted ' +
        'to fit.',
      inputSchema: designInput,
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    async (input) => {
      let values: FormValues
      try {
        values = toFormValues(input)
      } catch (error) {
        return {
          ...text(`That design cannot be run: ${explainValidation(error)}`),
          isError: true as const,
        }
      }

      const { ok: allowed, resetMs } = await submitLimiter.check(
        `mcp:${token.name}`,
      )
      if (!allowed) {
        return {
          ...text(
            `Too many designs submitted with this token. Try again in ${Math.ceil(resetMs / 1000)} seconds.`,
          ),
          isError: true as const,
        }
      }

      const outcome = await submitToBackend(buildJobParams(values))
      if (!outcome.ok) {
        log.error('mcp submit_design failed', undefined, {
          caller: token.name,
          code: outcome.error.code,
        })
        return {
          ...data(
            `Design "${values.name}" could not be submitted: ${outcome.error.message}`,
            { error: outcome.error },
          ),
          isError: true as const,
        }
      }

      const { jobId, result } = outcome.data
      log.info('mcp submit_design', { caller: token.name, jobId })

      // The local dev backend answers inline and keeps no job afterwards, so
      // say outright that there is nothing to poll for. An agent that called
      // get_design anyway would be told the job does not exist, and read that
      // as a failure.
      return data(
        result
          ? `Design "${values.name}" is already done and the result is attached. There is nothing to poll for.`
          : `Design "${values.name}" submitted as job ${jobId}. Call get_design with that id until it reports completed.`,
        result
          ? { job_id: jobId, status: 'completed', result }
          : { job_id: jobId, status: 'running' },
      )
    },
  )

  const origin = appOrigin()

  registerAppTool(
    server,
    'get_design',
    {
      title: 'Get a design',
      description:
        'Reports a submitted design by its job id: whether it is still running, and the ' +
        'full result once it is done — the optimized sequence, the 5′ and 3′ ' +
        'fragments, and the objectives before and after. Poll this after submit_design, ' +
        'unless submit_design already returned the result.',
      inputSchema: z.object({
        job_id: z
          .string()
          .min(1)
          .max(200)
          .describe('The id returned by submit_design.'),
      }),
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: DESIGN_VIEW_URI } },
    },
    async ({ job_id }) => {
      const polled = await fetchJobStatus(job_id)
      if (!polled.ok) {
        // The backend could not be asked at all — unreachable, timed out,
        // rejected. That is not the same as a job that does not exist, and
        // saying "not found" would send an agent off to resubmit.
        return {
          ...data(
            `Design ${job_id} could not be read: ${polled.error.message}`,
            { job_id, error: polled.error },
          ),
          isError: true as const,
        }
      }
      const status = polled.data

      if (status.status === 'not_found') {
        return notFound(
          `No design with job id "${job_id}". A job id is only valid on the deployment that issued it, and results are not kept forever.`,
        )
      }
      if (status.status === 'failed') {
        return {
          ...data(
            `Design ${job_id} failed: ${status.error?.message ?? 'no reason given'}.`,
            { job_id, status: status.status, error: status.error },
          ),
          isError: true as const,
        }
      }
      if (status.status !== 'completed') {
        return data(
          `Design ${job_id} is ${status.status}` +
            (status.stage ? ` (${status.stage})` : '') +
            '. Call get_design again shortly.',
          {
            job_id,
            status: status.status,
            progress: status.progress,
            stage: status.stage,
          },
        )
      }

      return data(`Design ${job_id} is done.`, {
        job_id,
        status: status.status,
        result: status.result,
      })
    },
  )

  if (origin) {
    registerAppResource(
      server,
      'Design result',
      DESIGN_VIEW_URI,
      {
        description:
          'A compact view of a finished design: its length, where it was split, the objectives that changed, and the optimized sequence.',
      },
      async () => ({
        contents: [
          {
            uri: DESIGN_VIEW_URI,
            mimeType: RESOURCE_MIME_TYPE,
            text: designViewHtml(`${origin}/mcp/app-bridge.js`),
            _meta: {
              ui: {
                // The one script the view loads. Nothing else is fetched.
                csp: { resourceDomains: [origin] },
              },
            },
          },
        ],
      }),
    )
  }

  return server
}
