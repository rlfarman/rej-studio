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
    'submit_design to optimize it. A coding sequence up to 12,000 bases is',
    'designed while you wait and the finished result comes back in the same',
    'call. A longer one, up to 45,000 bases, runs in the cloud: submit_design',
    'returns a job_id at once, and get_design with that job_id returns the',
    'result when it is done.',
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
      'fragments: the optimized sequence, both fragments, the split point and ' +
      'the objectives before and after. How it comes back depends on the ' +
      'length of the coding sequence (for protein input, the DNA it ' +
      'reverse-translates to, three bases per residue): up to 12,000 bases, ' +
      'the design runs during this call and the finished result is returned ' +
      'in it (status "completed"; typically a few seconds, about 20 at ' +
      '12,000). From 12,001 to 45,000 bases, it runs in the cloud and this ' +
      'call returns at once with a job_id and status "queued" or "running" ' +
      'plus an estimated_seconds; call get_design with that job_id after ' +
      'about that long to get the result. Longer than 45,000 bases is ' +
      'refused. The sequence is validated exactly as the web form validates ' +
      'it, so a sequence or option it would refuse is an error here too, not ' +
      'something adjusted to fit. Designs are deterministic: the same ' +
      'sequence, options and seed always produce the same design. ' +
      'Resubmitting a cloud design returns the same job_id rather than ' +
      'running it again; resubmitting an inline one costs the same compute ' +
      'again.',
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
    queued(name: string, id: string, seconds: number): string {
      return (
        `Design "${name}" is longer than an inline design, so it is running ` +
        `in the cloud as job ${id}. It should take about ${seconds} s; call ` +
        'get_design with this job_id then to get the result.'
      )
    },
    invalid(reason: string): string {
      return `That design cannot be run: ${reason}`
    },
    failed(name: string, reason: string): string {
      return `Design "${name}" failed: ${reason}`
    },
    /**
     * The length refusal: over the cloud cap, nothing here can design it.
     * It names the limit and what the caller can do about it in this
     * conversation.
     */
    tooLong(length: number, limit: number): string {
      return (
        `That sequence is ${length.toLocaleString('en-US')} bases; designs ` +
        `run here up to ${limit.toLocaleString('en-US')} (longer ones need ` +
        'more than the 5 minutes of compute a cloud design gets). Split it ' +
        'into shorter coding sequences and design each one.'
      )
    },
    /** A hand-off with no cloud designs on this deployment. */
    cloudUnavailable(length: number, inline: number): string {
      return (
        `That sequence is ${length.toLocaleString('en-US')} bases. Designs ` +
        `up to ${inline.toLocaleString('en-US')} bases run in the call; ` +
        'longer ones run in the cloud, which this deployment does not have ' +
        'set up. Split it into coding sequences of at most ' +
        `${inline.toLocaleString('en-US')} bases.`
      )
    },
  },

  getDesign: {
    title: 'Get a design',
    description:
      'Reads a cloud design by the job_id submit_design returned for a ' +
      'sequence over 12,000 bases (or one a colleague ran in the cloud from ' +
      'the web app and shared the id of). Returns status "queued" or ' +
      '"running" with an estimated_seconds while it runs — call again after ' +
      'about that long — then status "completed" with the same result ' +
      'submit_design returns inline, or "failed" with the reason. Designs of ' +
      '12,000 bases or fewer are returned by submit_design itself and have ' +
      'no job_id to read. Cloud designs are kept for 30 days (7 if they ' +
      'failed), then not found.',
    jobId: 'The job_id submit_design returned.',
    done(name: string): string {
      return `Design "${name}" is done and the result is attached.`
    },
    failed(name: string, reason: string): string {
      return `Design "${name}" failed: ${reason}`
    },
    pending(id: string, status: string, seconds: number | null): string {
      return (
        `Design ${id} is ${status} in the cloud. ` +
        (seconds === null
          ? 'Call get_design again in a minute.'
          : `It takes about ${seconds} s in all; call get_design again then.`)
      )
    },
    none(id: string): string {
      return (
        `There is no cloud design "${id}". Ids come from submit_design for ` +
        'sequences over 12,000 bases; shorter designs are returned by ' +
        'submit_design directly and have no id. A cloud design is kept for ' +
        '30 days (7 if it failed) or until its owner deletes it; after that, ' +
        'submit it again.'
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
