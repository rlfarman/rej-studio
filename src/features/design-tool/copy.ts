/** Human-friendly seconds formatter. Keep one decimal for short runs where
 *  precision is informative; round to int for longer ones where ".34s" is
 *  just noise. Handles sub-second runs with "<1s" to avoid "0s". */
function formatProcessingTime(seconds: number): string {
  if (seconds < 1) return '<1s'
  if (seconds < 10) return `${seconds.toFixed(1)}s`
  return `${Math.round(seconds)}s`
}

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
    labelProtein: 'Enter your sequence',
    labelDna: 'Enter your sequence',
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
    selectSpeciesHint:
      'Select a target species in Sequence design options to generate the DNA sequence.',
    reverseTranslateButton: 'Reverse translate to continue',
    reverseTranslateSpeciesRequired:
      'Select a target species before reverse translating.',
    reverseTranslateProteinRequired:
      'Enter a protein sequence before reverse translating.',
  },
  nameInput: {
    label: 'Choose a name for your coding sequence',
    placeholder: 'My Custom Sequence',
  },
  speciesOptions: {
    label: 'Optimize codon usage for species',
    noneDisabledHint:
      'Reverse-translating protein input requires a codon table — pick Human or Mouse.',
  },
  submit: {
    // Generic fallback shown on the submit button while the job is in flight
    // but no backend stage has arrived yet (pre-submit / first 500ms).
    processing: 'Running…',
    success: 'Optimization complete',
    idle: 'Run designer',
  },
  optimizationOptions: {
    objectivesHeading: 'Sequence objectives',
    constraintsHeading: 'Constraints',
    codonOptimize: {
      label: 'Codon usage optimization',
      description: 'Target species for codon-aware sequence design.',
      enableSpeciesFirst:
        'Enable codon usage optimization to select a species.',
    },
    removeCrypticSpliceSites: {
      label: 'Remove cryptic splice sites',
      description:
        'Minimize cryptic donor and acceptor motifs that may interfere with intended splicing.',
    },
    minimizeCpGs: {
      label: 'Minimize CpG sites',
      description: 'Reduce CpG dinucleotides which may reduce TLR recognition',
    },
    reduceKmer: {
      label: 'Increase k-mer diversity',
      description:
        'Pushes for unique 10-mers across the sequence to improve feasibility of synthesis',
    },
    enforceGc: {
      label: 'Enforce 35–60% GC content',
    },
  },
  weights: {
    label: 'Weight',
    inputAria: 'Weight',
  },
  stimulatoryIntrons: {
    fivePrime: {
      label: '5′ Stimulatory intron',
      description: '~150 bp upstream of the REJ intron',
    },
    threePrime: {
      label: '3′ Stimulatory intron',
      description: '~150 bp downstream of the REJ intron',
    },
    diagramFragment: 'sequence',
    diagramSpliceJunction: 'split point',
  },
  form: {
    title: 'REJ Studio Design Tool',
    description:
      'Paste a coding sequence, tune the objectives, and generate optimized sequences for RNA end-joining.',
    spliceJunctionLabel: 'Split point',
    spliceJunctionHint: 'Set where the CDS divides into 5′ and 3′ sequences.',
    optimizationHeading: 'Design Objectives',
    optimizationDescription: '',
    accordion: {
      codonOptimization: 'Sequence design options',
      codonOptimizationHint:
        'Select objectives for the codon-aware sequence designer.',
      stimulatoryIntrons: 'Stimulatory introns',
      stimulatoryIntronsHint:
        'Add cis-introns up or downstream of the REJ intron to boost trans-splicing',
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
    statusRunning: 'In progress…',
    statusCompleted: 'Completed',
    statusCompletedIn: (seconds: number) =>
      `Completed in ${formatProcessingTime(seconds)}`,
    statusFailedDefault: 'Something went wrong — try running again.',
    statusCancelled: 'Cancelled',
    buttonCancel: 'Cancel',
    buttonEdit: 'Edit',
    buttonRunAgain: 'Run again',
    running: {
      title: 'Designing your sequence…',
      defaultStage: 'This usually takes a few seconds.',
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
    completedIn: (seconds: number) =>
      `Completed in ${formatProcessingTime(seconds)}`,
    wggwSplitBadge: 'WGGW split',
    downloadZip: 'Download Results',
    intronTooltip: {
      fivePrime:
        '5′ stimulatory intron insertion site — place an intron here during synthesis to enhance 5′ sequence expression.',
      threePrime:
        '3′ stimulatory intron insertion site — place an intron here during synthesis to enhance 3′ sequence expression.',
    },
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
