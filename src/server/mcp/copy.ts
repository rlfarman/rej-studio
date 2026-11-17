/**
 * What the MCP endpoint says to an agent: the server's instructions, each
 * tool's description, and every refusal.
 *
 * Read by a model deciding what to call, so each description says what comes
 * back and when the tool is the right one, and each refusal says what to do
 * next. Nothing here invites a guess: an unknown gene is a plain "not found",
 * and an option the app would reject is an error, not a value adjusted to fit.
 */

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`
}

export const mcpCopy = {
  instructions: [
    'REJ Studio designs coding sequences for RNA end-joining: it optimizes a',
    'sequence and splits it into 5-prime and 3-prime fragments.',
    '',
    'Use search_genes and get_gene to find a sequence to work from, then',
    'submit_design to optimize it. submit_design runs the design while you',
    'wait and returns the finished result in the same call; there is nothing',
    'to poll for.',
    '',
    'These tools do only what the web app does. They will not invent a',
    'sequence, adjust an option to make a design work, or report a gene that',
    'is not in the gene data.',
  ].join('\n'),

  http: {
    notConfigured:
      'Agent access is not configured on this deployment (no MCP tokens are set).',
    unauthorized: 'A valid bearer token is required.',
    failed: 'The MCP endpoint failed to handle that request.',
    noGeneData: 'This deployment has no gene data to read.',
  },

  searchGenes: {
    title: 'Search genes',
    description:
      'Finds genes by symbol, name, Ensembl ID (ENSG/ENST) or alias, ranked ' +
      'by relevance exactly as the web app ranks them. Returns each match’s ' +
      'symbol, name, species and Ensembl gene ID. Use this when you have a ' +
      'name or a description and need the gene; use get_gene when you already ' +
      'know the exact symbol.',
    query: 'What to search for.',
    species: 'Which species to search. Defaults to both.',
    found(count: number, query: string, truncated: boolean): string {
      return (
        `${plural(count, 'gene')} match "${query}"` +
        (truncated
          ? '; more matched than are listed, so narrow the query if the gene you want is missing.'
          : '.')
      )
    },
    none(query: string, suggestions: string[]): string {
      const base =
        `No gene matches "${query}". The gene data holds human and mouse ` +
        'genes only; it is not a record of every gene that exists.'
      return suggestions.length > 0
        ? `${base} Similar symbols: ${suggestions.join(', ')}.`
        : base
    },
  },

  getGene: {
    title: 'Get a gene and its isoforms',
    description:
      'Returns one gene by its exact symbol, with its transcript isoforms: ' +
      'Ensembl transcript ID, length, and whether a coding sequence is on ' +
      'record. Use this to pick the isoform to design from; its coding ' +
      'sequence is what submit_design takes. Returns not found if the symbol ' +
      'is not in the gene data.',
    symbol: 'The exact gene symbol, for example TP53.',
    found(symbol: string, species: string, name: string, isoforms: number) {
      return `${symbol} (${species}): ${name}. ${plural(isoforms, 'isoform')}.`
    },
    none(symbol: string, species: string | undefined): string {
      return (
        `No gene with the symbol "${symbol}"${species ? ` in ${species}` : ''} ` +
        'is on record. Try search_genes, which matches names and aliases too.'
      )
    },
  },

  submitDesign: {
    title: 'Run a design',
    description:
      'Optimizes a coding sequence and splits it into 5-prime and 3-prime ' +
      'fragments, and returns the finished design in this call: the optimized ' +
      'sequence, both fragments, the split point and the objectives before ' +
      'and after. The design runs here, so expect the call to take a few ' +
      'seconds for a typical gene; there is no job to poll. The sequence is ' +
      'validated exactly as the web form validates it, so a sequence or ' +
      'option it would refuse is an error here too, not something adjusted ' +
      'to fit. Designs are deterministic: the same sequence, options and seed ' +
      'always produce the same design, so re-running one gains nothing and ' +
      'costs the same compute.',
    input: {
      name: 'A label for this design, used in the result and the export.',
      sequence:
        'The coding sequence to optimize. DNA by default: it must start with ' +
        'ATG, end in a stop codon, contain no internal stop, and have a ' +
        'length that is a multiple of three. Set sequence_type to "protein" ' +
        'to pass amino acids instead.',
      sequenceType:
        'Whether `sequence` is DNA or protein. A protein sequence is ' +
        'reverse-translated with the chosen species’ preferred codons ' +
        'before optimization, so species is required for it. Defaults to dna.',
      species:
        'Whose codon usage to optimize towards. "none" skips codon ' +
        'optimization and is not allowed for protein input. Defaults to none.',
      splitPoint:
        'Where the coding sequence is divided into 5-prime and 3-prime ' +
        'fragments, as a base position. Must be inside the sequence. Defaults ' +
        'to the same position the design tool would choose.',
      seed:
        'The random seed, for an exactly reproducible design. Omitted, the ' +
        'optimizer derives one from the sequence and echoes it back.',
    },
    done(name: string, seconds: number): string {
      return (
        `Design "${name}" is done (${seconds.toFixed(1)} s) and the result is ` +
        'attached. There is nothing to poll for.'
      )
    },
    invalid(reason: string): string {
      return `That design cannot be run: ${reason}`
    },
    failed(name: string, reason: string): string {
      return `Design "${name}" failed: ${reason}`
    },
    /**
     * The length refusal. It names the limit and sends the caller to the web
     * app, where the same optimizer runs in their own tab with no request
     * waiting on it.
     */
    tooLong(length: number, limit: number): string {
      return (
        `That sequence is ${length.toLocaleString()} bases; this endpoint ` +
        `designs up to ${limit.toLocaleString()}. A longer design takes more ` +
        'time than an MCP client will hold a request open for. Run it in the ' +
        'web app instead, where it runs in the browser with no request ' +
        'waiting on it, or split the sequence into shorter coding sequences.'
      )
    },
  },

  getDesign: {
    title: 'Get a design',
    description:
      'Looks up a design by id. Designs run inline on this deployment: ' +
      'submit_design returns the finished result in its own call, and nothing ' +
      'is stored afterwards, so there is no id to look up and nothing to ' +
      'poll. Call submit_design and read its result.',
    jobId: 'A design id from an older version of this endpoint.',
    inlineOnly(id: string): string {
      return (
        `There is no stored design "${id}". This deployment runs designs ` +
        'inline: submit_design returns the finished design in the same call, ' +
        'so call it again rather than polling. If you have a design id from ' +
        'this deployment, the result was already returned with it.'
      )
    },
  },

  rateLimited(what: string): string {
    return (
      `Too many ${what} with this token. Wait a minute and try again; nothing ` +
      'has changed.'
    )
  },

  designView: {
    name: 'Design result',
    description:
      'A compact view of a finished design: its length, where it was split, ' +
      'the objectives that changed, and the optimized sequence.',
  },
} as const
