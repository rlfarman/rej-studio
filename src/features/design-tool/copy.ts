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
    singleSplitOnly:
      'The designer runs one split point at a time — remove the extra split before running.',
  },
  /** Failures from the job pipeline, phrased for the person who hit them. */
  jobErrors: {
    unreachable:
      'Couldn’t reach the optimizer — your inputs are saved, try again.',
    backendUnavailable:
      'The optimizer is temporarily unavailable. Try again in a few seconds.',
    backendRejected: 'The optimizer rejected this run.',
    busy: 'The optimizer is busy right now. Try again in a few seconds.',
    rateLimited: (seconds: number) =>
      `That's a lot of runs — wait ${seconds}s and try again.`,
    submitTimeout:
      'The optimizer didn’t answer in time. Your inputs are saved — try again.',
    statusTimeout: 'Lost contact with the optimizer while checking progress.',
    pollTimeout: 'Timed out waiting for the result.',
    invalidInput: 'The designer couldn’t accept these inputs.',
    invalidJobId: 'That job reference isn’t valid.',
    splitPointPastEnd: (point: number, length: number) =>
      `The split point (${point.toLocaleString()}) is past the end of the ${length.toLocaleString()}-base sequence.`,
    wggwSiteOutsideSequence:
      'The selected WGGW motif lies outside the coding sequence.',
    unauthorized:
      'The optimizer refused this request. The compute backend may be misconfigured.',
    sessionExpired: 'Your session expired — sign in again to run the designer.',
    unexpectedResponse:
      'The optimizer returned something unexpected. This run was not saved.',
    cancelled: 'Cancelled',
    notFound: 'No longer available',
    failed: 'Job failed',
    unknown: 'Something went wrong — try running again.',
    browserUnsupported:
      'This browser can’t run the designer on its own. Try a current version of Chrome, Firefox, Safari or Edge.',
    browserFailed:
      'The designer stopped unexpectedly in your browser. Running again usually works.',
  },
  /** Designs that run in this browser while the person is elsewhere. */
  browserRun: {
    notifyOptIn: 'Notify me when done',
    notifyOptInHint:
      'Get a browser notification when a design finishes while this tab is in the background.',
    completedTitle: 'Design ready',
    completedBody: (name: string) => `${name} has finished.`,
    failedTitle: 'Design failed',
    failedBody: (name: string, reason: string) => `${name}: ${reason}`,
    interrupted:
      'Interrupted — the tab closed before this design finished. Run it again for the identical design.',
    interruptedToast: (count: number) =>
      count === 1
        ? 'A design was interrupted when its tab closed.'
        : `${count} designs were interrupted when their tab closed.`,
    interruptedToastAction: 'Open',
  },
  draft: {
    restored: 'Restored your unsaved draft.',
    discard: 'Discard draft',
    dismiss: 'Dismiss',
    dismissAria: 'Dismiss the restored-draft notice',
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
    summary: {
      recommendedLabel: 'Recommended settings',
      customLabel: 'Custom settings',
      /** Joined into one sentence, e.g. "Codon usage (human) · CpG · GC". */
      none: 'No objectives selected',
      customize: 'Customize',
      hide: 'Hide options',
      editAria: 'Customize design objectives',
      items: {
        codonHuman: 'codon usage (human)',
        codonMouse: 'codon usage (mouse)',
        spliceSites: 'splice sites',
        cpg: 'CpG',
        kmer: 'k-mer diversity',
        gc: 'GC 35–60%',
        intronsBoth: 'both stimulatory introns',
        intron5: '5′ stimulatory intron',
        intron3: '3′ stimulatory intron',
      },
    },
    advanced: {
      label: 'Advanced: objective weights',
    },
    help: {
      codonOptimize:
        'Rewrites codons to the ones the target species uses most often, without changing the protein.',
      spliceSites:
        'Cryptic splice sites are donor/acceptor motifs the cell may splice at by mistake, cutting the transcript in the wrong place.',
      cpg: 'CpG is a C followed by a G. Fewer CpGs can lower innate immune (TLR9) recognition of the delivered DNA.',
      kmer: 'A k-mer is any 10-base window. Making them unique avoids repeats that make DNA synthesis fail or misassemble.',
      gc: 'Keeps the G+C fraction in a synthesis-friendly band; very high or low GC is hard to make and can translate poorly.',
      stimulatoryIntrons:
        'Short cis-acting introns placed either side of the REJ intron. They recruit splicing factors and can raise trans-splicing efficiency.',
    },
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
    hint: 'Relative importance of each objective, 0–100. Higher values pull the designer harder toward that objective when they conflict. Defaults to 1 for every objective — equal weighting.',
    /** Shown next to an objective's name while that objective is turned off. */
    off: '(off)',
  },
  splitPoint: {
    preselected: (bp: string) =>
      `Nearest WGGW motif to your split point — the split lands at ${bp} bp. Use ‹ › to pick another.`,
    noSites:
      'No WGGW motif found in this sequence. Drag the split point or enter a position; the designer will install a motif near it.',
    noSitesShort: 'No WGGW motif found',
    emptyTitle: 'No motif selected',
    emptyBody: 'Pick a motif on the strip above, or use ‹ › to step through.',
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
    title: 'Design a sequence',
    description:
      'Paste a coding sequence, choose a split point, and generate optimized 5′ and 3′ sequences for RNA end-joining.',
    spliceJunctionLabel: 'Split point',
    spliceJunctionHint: 'Set where the CDS divides into 5′ and 3′ sequences.',
    spliceJunctionHelp:
      'The CDS is delivered as two halves that rejoin in the cell. The split lands inside a WGGW motif (W = A or T), which the end-joining machinery needs at the junction.',
    runSummary: {
      noSequence: 'Add a coding sequence to run the designer.',
      ready: (bp: string, objectives: number) =>
        `${bp} bp · ${objectives} objective${objectives === 1 ? '' : 's'}`,
      splitAt: (bp: string) => `split at ${bp} bp`,
    },
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
        '5′ REJ module insertion site — insert the 5′ REJ module here during construct assembly.',
      threePrime:
        '3′ REJ module insertion site — insert the 3′ REJ module here during construct assembly.',
      stimulatory:
        'Optional stimulatory intron insertion site — insert a stimulatory intron here if including optional stimulatory introns.',
    },
    splitAtPosition: 'Split after base',
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
      runRecord: 'Run record',
      replay: 'What changed',
    },
    summaries: {
      codonsChanged: (changed: string, total: string) =>
        `${changed} of ${total} codons changed`,
      objectivesPassed: (passed: number, total: number) =>
        `${passed} of ${total} passed`,
      junction: (splitPoint: string) => `±18 bp at ${splitPoint}`,
      wggwSites: (count: number) => `${count} site${count === 1 ? '' : 's'}`,
      // A collapsed row has to account for every outcome worth opening it
      // for. Counting only the good news left a run that traded one objective
      // for another looking exactly like a run where nothing happened.
      changed: (counts: {
        fixed: number
        broken: number
        unresolved: number
        added: number
      }) =>
        [
          counts.fixed > 0 ? `${counts.fixed} fixed` : null,
          counts.broken > 0 ? `${counts.broken} broken` : null,
          counts.unresolved > 0 ? `${counts.unresolved} still failing` : null,
          counts.added > 0 ? `${counts.added} new` : null,
        ]
          .filter(Boolean)
          .join(' \u00b7 '),
    },
    replay: {
      noReport:
        'This result has no objectives report, so there is nothing to step through.',
      noFinalReport:
        'This run recorded the objectives before optimization but not after, so there is nothing to compare. Run the design again; if it happens every time, the final evaluation is failing.',
      noInitialReport:
        'This run recorded the objectives after optimization but not before, so there is nothing to compare.',
      nothingChanged:
        'Every objective held: none was fixed, broken or left failing.',
      showAll: 'Step through all of them anyway',
      showAllWithCount: (count: number) =>
        `Include the ${count} that held throughout`,
      groupLabel: 'Objectives, one at a time. Use the arrow keys to move.',
      position: (current: number, total: number) => `${current} of ${total}`,
      previous: 'Previous objective',
      next: 'Next objective',
      beforeLabel: 'Before',
      afterLabel: 'After',
      passed: 'Passed',
      failed: 'Failed',
      absent: 'Not evaluated',
      outcomes: {
        fixed: 'Fixed',
        broken: 'Broken',
        unresolved: 'Still failing',
        held: 'Held',
        added: 'New',
        dropped: 'Dropped',
      },
      track: {
        count: (count: number) =>
          `${count} region${count === 1 ? '' : 's'} flagged`,
        none: (label: string) =>
          `${label}: nothing flagged along the sequence.`,
        regions: (label: string, count: number) =>
          `${label}: ${count} region${count === 1 ? '' : 's'} flagged along the sequence.`,
      },
      tableCaption: (objective: string) =>
        `${objective}, before and after optimization`,
      headers: {
        report: 'Report',
        verdict: 'Verdict',
        score: 'Score',
        flagged: 'Regions flagged',
      },
    },
    runRecord: {
      description:
        'Everything needed to repeat or cite this run. Submitting the same sequence and options with the seed below gives the same design.',
      summary: 'Repeatable',
      unavailable:
        'This result predates run records, so there is nothing to show. Run the design again to get one.',
      fields: {
        startedAt: 'Run at',
        duration: 'Duration',
        input: 'Input sequence',
        inputValue: (length: string, sha256: string) =>
          `${length} nt \u00b7 SHA-256 ${sha256}`,
        seed: 'Seed',
        algorithm: 'Algorithm',
        commit: 'Commit',
        dnachisel: 'DNAChisel',
        python: 'Python',
        // The dataset the deployment was serving, which is not a claim about
        // where this sequence came from.
        corpus: 'Gene corpus loaded',
        options: 'Options applied',
      },
      optionsCount: (count: number) =>
        `${count} option${count === 1 ? '' : 's'}`,
      methodsHeading: 'Methods',
      copyRecord: 'Copy record',
      copyRecordAria: 'Copy the run record as JSON',
      copyMethods: 'Copy methods',
      copyMethodsAria: 'Copy the methods paragraph',
      downloadRecord: 'Download JSON',
      downloadRecordAria: 'Download the run record as a JSON file',
      copiedRecord: 'Run record copied',
      copiedMethods: 'Methods paragraph copied',
      tableCaption: 'The facts recorded for this run',
      optionsTableCaption: 'The options applied to this run',
      optionName: 'Option',
      optionValue: 'Value',
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
