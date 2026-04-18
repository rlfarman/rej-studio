export const designToolCopy = {
  validation: {
    dna: {
      required: 'Coding sequence is required.',
      invalidNucleotides:
        'Sequence must contain only valid nucleotides (A, C, G, T, or U).',
      tooLong: 'Sequence must be 50,000 characters or fewer.',
      notMultipleOfThree:
        'Sequence length must be a multiple of 3 (complete codons).',
      missingStartCodon:
        'Sequence must begin with a start codon (ATG). Without it, translation can’t start.',
      missingStopCodon:
        'Sequence must end with a stop codon (TAA, TAG, or TGA). Without it, the ribosome will read through into downstream sequence.',
      prematureStopCodon:
        'Sequence contains premature stop codon(s) in the reading frame. This will produce a truncated protein.',
    },
    protein: {
      required: 'Protein sequence is required.',
      tooLong: 'Protein sequence must be 16,666 residues or fewer.',
      invalidAminoAcids:
        'Sequence must contain only standard amino acid letters (A, C, D, E, F, G, H, I, K, L, M, N, P, Q, R, S, T, V, W, Y) or * for stop.',
      internalStop:
        'Sequence contains internal stop character(s) (*). Only a terminal * is allowed.',
    },
    name: {
      required: 'A name is required.',
      tooLong: 'Name must be 250 characters or fewer.',
    },
    speciesRequiredForProtein:
      'Species selection is required for protein sequences (needed for codon preference during reverse translation).',
    spliceTooLarge: (max: number) =>
      `Split position must be ≤ ${max} (sequence length − 1).`,
  },
  sequenceInput: {
    labelProtein: 'Enter your protein sequence',
    labelDna: 'Enter your coding sequence',
    typeToggleAria: 'Sequence type',
    typeDna: 'DNA',
    typeProtein: 'Protein',
    uploadAria: 'Upload FASTA file',
    uploadLong: 'Upload FASTA',
    uploadShort: 'FASTA',
    placeholderProtein:
      'MVLSPADKTN... (paste amino acid sequence or upload FASTA)',
    placeholderDna: 'ATGATTACA... (paste sequence or upload FASTA)',
    unitResidues: 'residues',
    unitBp: 'bp',
    noValidAminoAcids: 'No valid amino acid characters found.',
    noValidNucleotides: 'No valid nucleotide characters found.',
    cleanedSummary: (source: string, parts: string) => `${source}: ${parts}.`,
    usedFirstSequence: (ignored: number) =>
      `used first sequence (${ignored} additional sequence${ignored > 1 ? 's' : ''} ignored)`,
    headersStripped: (count: number) =>
      `${count} header${count > 1 ? 's' : ''} stripped`,
    charsRemoved: (count: number, charType: string) =>
      `${count} ${charType} character${count > 1 ? 's' : ''} removed`,
    pasteSource: 'Paste cleaned',
    fastaSource: 'FASTA imported',
    charTypeNonAminoAcid: 'non-amino-acid',
    charTypeNonNucleotide: 'non-nucleotide',
    reverseTranslated: (bp: string, species: string) =>
      `→ ${bp} bp DNA generated (${species} codon preferences)`,
    selectSpeciesHint: 'Select a species above to generate the DNA sequence.',
  },
  nameInput: {
    label: 'Choose a name for your coding sequence',
    placeholder: 'My Custom Sequence',
  },
  speciesOptions: {
    label: 'Optimize codon usage for species',
  },
  submit: {
    stageCodons: 'Optimizing codons…',
    stageSplit: 'Finding split points…',
    stageWggw: 'Inserting WGGW motifs…',
    stageGenerate: 'Generating sequences…',
    success: 'Optimization complete',
    idle: 'Run optimizer',
  },
  optimizationOptions: {
    objectivesHeading: 'Sequence objectives',
    constraintsHeading: 'Constraints',
    removeCrypticSpliceSites: {
      label: 'Remove cryptic splice sites',
      description:
        'Penalizes 5′ donor- and 3′ acceptor-like motifs the spliceosome could use to silently excise part of the CDS in mammalian cells.',
    },
    minimizeCpGs: {
      label: 'Minimize CpG sites',
      description:
        'Reduces CpG dinucleotides, which can trigger TLR9-mediated innate immune sensing — and, for constructs that integrate, promoter-level methylation.',
    },
    reduceKmer: {
      label: 'Reduce k-mer complexity',
      description:
        'Pushes for unique 10-base k-mers across the sequence. Repeats at this length make synthesis flakier and increase homologous-recombination risk during assembly.',
    },
    enforceGc: {
      label: 'Enforce 35–60% GC content',
      description:
        'Keeps GC content in the 35–60% window typical of stable mammalian CDSs. Values outside this range often correlate with poor transcript stability or synthesis issues.',
      badge: 'Hard constraint',
    },
  },
  weights: {
    tiers: {
      gentle: 'Gentle',
      moderate: 'Moderate',
      strong: 'Strong',
      aggressive: 'Aggressive',
    },
    tierAria: (label: string) => `${label} tier`,
    exactAria: (label: string) => `${label} exact weight`,
    codonOptimize: {
      label: 'Codon optimization',
      description:
        'How strongly to prefer codons favored by the target species.',
      enableLinkText: 'Select a species',
      enableSuffix: 'above to enable codon optimization.',
    },
    removeSplice: {
      label: 'Cryptic splice site removal',
      description:
        'How aggressively to eliminate splice-like motifs. Higher values remove more sites but constrain codon choice.',
      enableLinkText: 'Enable cryptic splice site removal',
      enableSuffix: 'above to set this weight.',
    },
    minimizeCpG: {
      label: 'CpG minimization',
      description:
        'How strongly to avoid CpG dinucleotides. High values greatly reduce CpGs but may lower GC content.',
      enableLinkText: 'Enable CpG minimization',
      enableSuffix: 'above to set this weight.',
    },
    reduceKmer: {
      label: 'k-mer complexity reduction',
      description:
        'How strongly to diversify 10-mer repeats. Helps synthesis and reduces recombination risk.',
      enableLinkText: 'Enable k-mer complexity reduction',
      enableSuffix: 'above to set this weight.',
    },
  },
  stimulatoryIntrons: {
    fivePrime: {
      label: '5′ stimulatory intron',
      description:
        'Marks a site ~150 bp upstream of the split (at the nearest WGGW-compatible position) where you can place an intron during synthesis — intended to enhance 5′ fragment expression.',
    },
    threePrime: {
      label: '3′ stimulatory intron',
      description:
        'Marks a site ~150 bp downstream of the split (at the nearest WGGW-compatible position) where you can place an intron during synthesis — intended to enhance 3′ fragment expression.',
    },
    diagramFragment: 'fragment',
    diagramSpliceJunction: 'split point',
  },
  form: {
    title: 'REJ Studio Design Tool',
    description:
      'Paste a coding sequence, tune the objectives, and generate optimized fragments for RNA end-joining.',
    spliceJunctionLabel: 'Split point',
    spliceJunctionHint: 'Set where the CDS divides into 5′ and 3′ fragments.',
    optimizationHeading: 'Optimization',
    optimizationDescription:
      'Fine-tune individual parameters, then run the optimizer.',
    accordion: {
      codonOptimization: 'Codon optimization',
      codonOptimizationHint: 'Control which sequence features are optimized.',
      stimulatoryIntrons: 'Stimulatory introns',
      stimulatoryIntronsHint: 'Add introns to boost fragment expression.',
      parameterWeights: 'Parameter weights',
      parameterWeightsHint:
        'Control how much each objective influences the result.',
    },
    savedInputsIncompatible:
      'Saved inputs from this job were incompatible with the current form — defaults were used instead.',
    fixErrorsBeforeRerun: 'Fix the form errors before re-running.',
  },
  jobHeader: {
    untitled: 'Untitled run',
    statusRunning: 'Optimizing sequence…',
    statusCompleted: 'Completed',
    statusCompletedIn: (seconds: number) => `Completed in ${seconds}s`,
    statusFailedDefault: 'Job failed',
    statusCancelled: 'Cancelled',
    buttonCancel: 'Cancel',
    buttonEdit: 'Edit',
    buttonRunAgain: 'Run again',
    running: {
      title: 'Optimizing your sequence…',
      defaultStage:
        'Running DNAChisel on the server. This usually takes a few seconds.',
    },
    speciesLabel: {
      none: '',
      human: 'Human',
      mouse: 'Mouse',
    },
  },
  recentJobs: {
    label: 'Recent jobs',
    empty: 'No recent jobs. Run an optimization to see it here.',
    menuAria: 'Recent jobs',
    justNow: 'just now',
    minutesAgo: (m: number) => `${m}m ago`,
    hoursAgo: (h: number) => `${h}h ago`,
    daysAgo: (d: number) => `${d}d ago`,
    running: 'running',
    cancelAria: (name: string) => `Cancel ${name}`,
    removeAria: (name: string) => `Remove ${name} from recent jobs`,
    cancelledMessage: 'Cancelled',
  },
  results: {
    heading: 'Results',
    completedIn: (seconds: number) => `Completed in ${seconds}s`,
    wggwSplitBadge: 'WGGW split',
    downloadZip: 'Download ZIP',
    splitAtPosition: 'Split at position',
    splitRatio: (left: number, right: number) => `(${left}% / ${right}%)`,
    sequenceCard: {
      fiveLabel: '5′ sequence',
      threeLabel: '3′ sequence',
      fullLabel: 'Full optimized',
      exportAria: (label: string) => `Export or copy ${label}`,
      exportLabel: 'Export',
      copied: 'Copied',
      copyFasta: 'Copy FASTA',
      copySequence: 'Copy sequence',
      downloadFasta: 'Download FASTA',
    },
    sections: {
      visualizations: 'Sequence visualizations',
      codonChanges: 'Codon changes',
      junctionContext: 'Junction context',
      restrictionSites: 'Restriction site map',
      codonUsageDelta: 'Codon usage delta',
      aavPackaging: 'AAV packaging',
      wggwDetails: 'WGGW motif details',
      objectivesReport: 'Objectives report',
    },
    summaries: {
      codonsChanged: (changed: string, total: string) =>
        `${changed} of ${total} codons changed`,
      objectivesPassed: (passed: number, total: number) =>
        `${passed} of ${total} passed`,
      junction: (splitPoint: string) => `±18 bp at ${splitPoint}`,
      wggwSites: (count: number) => `${count} site${count === 1 ? '' : 's'}`,
    },
    wggwTable: {
      main: 'Main junction',
      stim5: '5′ stimulatory',
      stim3: '3′ stimulatory',
      headers: {
        site: 'Site',
        position: 'Position',
        motif: 'Motif',
        distance: 'Distance',
        originalCodons: 'Original codons',
        newCodons: 'New codons',
      },
    },
  },
  aav: {
    preflight: {
      single: 'Single AAV',
      dual: 'Dual vector',
      dualTight: 'Dual vector (tight)',
      exceeds: 'Over AAV limit',
    },
    results: {
      heading: 'AAV packaging estimate',
      fiveVector: '5′ vector',
      threeVector: '3′ vector',
      fits: 'Fits',
      tight: 'Tight',
      overLimit: 'Over limit',
    },
  },
} as const
