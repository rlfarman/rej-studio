export const onboardingCopy = {
  welcomeDialog: {
    title: 'Welcome to REJ Studio',
    description: 'Design optimized RNA End-Joining sequences in three steps.',
    skip: 'Skip for now',
    takeTour: 'Take the tour',
    features: {
      searchGenes: {
        title: 'Search genes',
        description: 'Browse 30,000+ genes across human and mouse genomes',
      },
      compareIsoforms: {
        title: 'Compare isoforms',
        description:
          'View isoform metrics, suitability scores, and sequence identity',
      },
      optimizeSequences: {
        title: 'Optimize sequences',
        description:
          'Design split RNA End-Joining sequences with codon optimization and more',
      },
    },
  },
  tours: {
    home: {
      search: {
        title: 'Search for genes',
        description:
          'Type a gene symbol like ATM or TP53 to get started. You can also press ⌘K from any page to open search.',
      },
      paste: {
        title: 'Or paste your own sequence',
        description:
          'Already have a coding sequence? Jump straight to the Design Tool and paste it in.',
      },
    },
    geneDetail: {
      favorite: {
        title: 'Save to favorites',
        description:
          'Star genes you work with frequently. They appear in the sidebar for quick access.',
      },
      compare: {
        title: 'Compare isoforms',
        description:
          'Sort by CDS length, GC content, or suitability score. Click a row to expand and preview the split.',
      },
      customize: {
        title: 'Customize or download',
        description:
          'Send any isoform to the Design Tool for optimization, or download the sequence directly as FASTA.',
      },
    },
    designTool: {
      sequence: {
        title: 'Name & sequence',
        description:
          'Give your job a name and paste a coding sequence. Toggle between DNA and protein input — protein is auto-reverse-translated.',
      },
      splicer: {
        title: 'Set the split point',
        description:
          'Drag the scissors to control where the sequence divides into 5′ and 3′ fragments for dual-AAV delivery.',
      },
      optimization: {
        title: 'Tune optimization',
        description:
          'Configure codon optimization, splice site removal, CpG minimization, and stimulatory introns.',
      },
      submit: {
        title: 'Run the optimizer',
        description:
          'Submit your sequence. Results include optimized fragments, codon changes, restriction sites, and downloadable files.',
      },
    },
  },
} as const
