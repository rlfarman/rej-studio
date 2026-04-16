/**
 * User-facing copy for the design-tool feature.
 *
 * Single source of truth for every string the user sees in this feature —
 * form labels, validation messages, toasts, button states, empty states.
 * Components and schemas should import from here rather than inlining text.
 *
 * Organized by surface (form, validation, toasts, …) rather than by
 * component, so a copy edit is one file and one search.
 */

export const designToolCopy = {
  page: {
    title: 'REJ Studio Design Tool',
    description:
      'Optimize a DNA or protein sequence for RNA end-joining experiments',
  },

  form: {
    name: {
      label: 'Choose a name for your coding sequence',
      placeholder: 'My Custom Sequence',
    },
    sequence: {
      labelDna: 'Enter your coding sequence',
      labelProtein: 'Enter your protein sequence',
      placeholderDna: 'ATGATTACA... (paste sequence or upload FASTA)',
      placeholderProtein:
        'MVLSPADKTN... (paste amino acid sequence or upload FASTA)',
      unitDna: 'bp',
      unitProtein: 'residues',
      uploadLong: 'Upload FASTA',
      uploadShort: 'FASTA',
      typeToggleAriaLabel: 'Sequence type',
      typeDna: 'DNA',
      typeProtein: 'Protein',
      reverseTranslatedNote: (bp: number, species: string) =>
        `→ ${bp.toLocaleString()} bp DNA generated (${species} codon preferences)`,
      selectSpeciesToTranslate:
        'Select a species above to generate the DNA sequence.',
    },
    species: {
      label: 'Harmonize codon usage for species',
    },
    splicer: {
      label: 'Splice junction',
      description: "Set where the sequence splits into 5' and 3' fragments.",
    },
    optimization: {
      title: 'Optimization',
      description: 'Fine-tune individual parameters.',
    },
    review: {
      title: 'Review & Run',
      description: 'Run the optimizer to generate your split sequences.',
    },
    sections: {
      objectives: 'Sequence objectives',
      constraints: 'Constraints',
      codonOptimization: {
        label: 'Codon optimization',
        description: 'Control which sequence features are optimized.',
      },
      stimulatoryIntrons: {
        label: 'Stimulatory introns',
        description: 'Add introns to boost fragment expression.',
      },
      weights: {
        label: 'Parameter weights',
        description: 'Control how much each objective influences the result.',
      },
    },
  },

  toggles: {
    removeCrypticSpliceSites: {
      label: 'Remove cryptic splice sites',
      description:
        'Eliminates donor- and acceptor-like motifs to prevent unintended mRNA splicing in mammalian cells.',
    },
    minimizeCpgs: {
      label: 'Minimize CpG sites',
      description:
        'Reduces CpG dinucleotides to lower silencing risk from DNA methylation.',
    },
    reduceKmerComplexity: {
      label: 'Reduce k-mer complexity',
      description:
        'Diversifies 10-mer repeats to ease synthesis and reduce recombination risk.',
    },
    enforceGcContent: {
      label: 'Enforce 35–60% GC content',
      description:
        'Keeps GC content within the range optimal for mRNA stability and expression.',
      badge: 'Hard constraint',
    },
    stim5Prime: {
      label: '5′ stimulatory intron',
      description:
        "Inserted ~150 bp upstream of the junction, at the nearest compatible splice site, to boost 5' fragment expression.",
    },
    stim3Prime: {
      label: '3′ stimulatory intron',
      description:
        "Inserted ~150 bp downstream of the junction, at the nearest compatible splice site, to boost 3' fragment expression.",
    },
  },

  weights: {
    tiers: [
      { label: 'Gentle', value: 1 },
      { label: 'Moderate', value: 3 },
      { label: 'Strong', value: 10 },
      { label: 'Aggressive', value: 50 },
    ],
    codonOptimize: {
      label: 'Codon optimization',
      description:
        'How strongly to prefer codons favored by the target species.',
      enableLink: 'Select a species',
      enableSuffix: 'above to enable codon optimization.',
    },
    removeCrypticSpliceSites: {
      label: 'Cryptic splice site removal',
      description:
        'How aggressively to eliminate splice-like motifs. Higher values remove more sites but constrain codon choice.',
      enableLink: 'Enable cryptic splice site removal',
      enableSuffix: 'above to set this weight.',
    },
    minimizeCpgs: {
      label: 'CpG minimization',
      description:
        'How strongly to avoid CpG dinucleotides. High values greatly reduce CpGs but may lower GC content.',
      enableLink: 'Enable CpG minimization',
      enableSuffix: 'above to set this weight.',
    },
    reduceKmerComplexity: {
      label: 'k-mer complexity reduction',
      description:
        'How strongly to diversify 10-mer repeats. Helps synthesis and reduces recombination risk.',
      enableLink: 'Enable k-mer complexity reduction',
      enableSuffix: 'above to set this weight.',
    },
  },

  validation: {
    name: {
      required: 'A name is required.',
      tooLong: 'Name must be 250 characters or fewer.',
    },
    dna: {
      required: 'Coding sequence is required.',
      invalidChars:
        'Sequence must contain only valid nucleotides (A, C, G, T, or U).',
      tooLong: 'Sequence must be 50,000 characters or fewer.',
      notMultipleOfThree:
        'Sequence length must be a multiple of 3 (complete codons).',
      missingStart:
        'Sequence must begin with a start codon (ATG). Without it, translation cannot initiate.',
      missingStop:
        'Sequence must end with a stop codon (TAA, TAG, or TGA). Without it, the ribosome will read through into downstream sequence.',
      prematureStop:
        'Sequence contains premature stop codon(s) in the reading frame. This will produce a truncated protein.',
    },
    protein: {
      required: 'Protein sequence is required.',
      tooLong: 'Protein sequence must be 16,666 residues or fewer.',
      invalidChars:
        'Sequence must contain only standard amino acid letters (A, C, D, E, F, G, H, I, K, L, M, N, P, Q, R, S, T, V, W, Y) or * for stop.',
      internalStop:
        'Sequence contains internal stop character(s) (*). Only a terminal * is allowed.',
      speciesRequired:
        'Species selection is required for protein sequences (needed for codon preference during reverse translation).',
    },
    splicer: {
      positionTooHigh: (max: number) =>
        `Split position must be ≤ ${max} (sequence length − 1).`,
    },
  },

  toasts: {
    incompatibleSavedInputs:
      'Saved inputs from this job were incompatible with the current form — defaults were used instead.',
    fixErrorsBeforeRerun: 'Fix the form errors before re-running.',
    noValidNucleotides: 'No valid nucleotide characters found.',
    noValidAminoAcids: 'No valid amino acid characters found.',
    cleanedSummary: (source: string, parts: string[]) =>
      `${source}: ${parts.join(', ')}.`,
    cleaned: {
      pasteSource: 'Paste cleaned',
      fastaSource: 'FASTA imported',
      extraSequencesIgnored: (n: number) =>
        `used first sequence (${n} additional sequence${n > 1 ? 's' : ''} ignored)`,
      headersStripped: (n: number) => `${n} header${n > 1 ? 's' : ''} stripped`,
      charsRemoved: (n: number, kind: 'non-amino-acid' | 'non-nucleotide') =>
        `${n} ${kind} character${n > 1 ? 's' : ''} removed`,
    },
  },

  submit: {
    idle: 'Run optimizer',
    success: 'Optimization complete',
    processingStages: [
      'Optimizing codons\u2026',
      'Finding split points\u2026',
      'Inserting WGGW motifs\u2026',
      'Generating sequences\u2026',
    ],
  },

  jobHeader: {
    untitledRun: 'Untitled run',
    speciesLabels: {
      none: '',
      human: 'Human',
      mouse: 'Mouse',
    },
    status: {
      running: 'Optimizing codons…',
      completed: 'Completed',
      completedWithTime: (seconds: number) => `Completed in ${seconds}s`,
      failedFallback: 'Job failed',
      cancelled: 'Cancelled',
    },
    actions: {
      cancel: 'Cancel',
      edit: 'Edit',
      rerun: 'Re-run',
      runAgain: 'Run again',
    },
  },

  running: {
    heading: 'Optimizing your sequence…',
    defaultStage:
      'Running DNAChisel on the server. This usually takes a few seconds.',
  },
} as const
