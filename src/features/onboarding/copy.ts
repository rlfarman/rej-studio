/**
 * User-facing copy for the onboarding feature.
 *
 * Single source of truth for welcome dialog text and guided-tour step
 * titles/descriptions. Components import from here rather than inlining text.
 */

export const onboardingCopy = {
  welcome: {
    title: 'Welcome to REJ Studio',
    description: 'Design optimized RNA End-Joining sequences in three steps.',
    startButton: 'Take the tour',
    skipButton: 'Skip for now',
  },

  features: [
    {
      title: 'Search genes',
      description: 'Browse 30,000+ genes across human and mouse genomes',
    },
    {
      title: 'Compare isoforms',
      description:
        'View isoform metrics, suitability scores, and sequence identity',
    },
    {
      title: 'Optimize sequences',
      description:
        'Design split-intein sequences with codon optimization and more',
    },
  ],

  tours: {
    home: {
      steps: [
        {
          title: 'Search for genes',
          description:
            'Type a gene symbol like ATM or TP53 to get started. You can also press \u2318K from any page to open search.',
        },
        {
          title: 'Or paste your own sequence',
          description:
            'Already have a coding sequence? Jump straight to the Design Tool and paste it in.',
        },
      ],
    },
    geneDetail: {
      steps: [
        {
          title: 'Save to favorites',
          description:
            'Star genes you work with frequently. They appear in the sidebar for quick access.',
        },
        {
          title: 'Compare isoforms',
          description:
            'Sort by CDS length, GC content, or suitability score. Click a row to expand and preview the split.',
        },
        {
          title: 'Customize or download',
          description:
            'Send any isoform to the Design Tool for optimization, or download the sequence directly as FASTA.',
        },
      ],
    },
    designTool: {
      steps: [
        {
          title: 'Name & sequence',
          description:
            'Give your job a name and paste a coding sequence. Toggle between DNA and protein input \u2014 protein is auto-reverse-translated.',
        },
        {
          title: 'Set the split point',
          description:
            'Drag the scissors to control where the sequence divides into 5\u2032 and 3\u2032 fragments for dual-AAV delivery.',
        },
        {
          title: 'Tune optimization',
          description:
            'Configure codon optimization, splice site removal, CpG minimization, and stimulatory introns.',
        },
        {
          title: 'Run the optimizer',
          description:
            'Submit your sequence. Results include optimized fragments, codon changes, restriction sites, and downloadable files.',
        },
      ],
    },
  },
} as const
