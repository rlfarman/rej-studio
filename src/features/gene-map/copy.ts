export const geneMapCopy = {
  tabLabel: 'Map',
  tabAria: 'View gene map',
  heading: 'Gene Map',
  subheading: (length: number) =>
    `${length.toLocaleString()} bp · ${(length / 3).toLocaleString(undefined, {
      maximumFractionDigits: 0,
    })} codons`,
  emptyState: 'Select an isoform to explore its sequence.',
  layers: {
    title: 'Layers',
    aaClass: 'Amino acid class',
    cpg: 'CpG islands',
    restriction: 'Restriction sites',
    gcHeatmap: 'GC heatmap',
  },
  controls: {
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    fit: 'Fit to view',
    resetAria: 'Reset view',
  },
  hints: {
    pan: 'Drag to pan',
    zoom: 'Pinch or ⌘/Ctrl-scroll to zoom',
    keys: '+/− to zoom, arrows to pan, 0 to fit',
  },
  isoform: {
    selectAria: 'Select isoform to view',
    placeholder: 'Pick an isoform',
  },
  position: (bp: number) => `${bp.toLocaleString()} bp`,
  range: (from: number, to: number) =>
    `${from.toLocaleString()}–${to.toLocaleString()} bp`,
  legend: {
    title: 'Amino acid class',
    hydrophobic: 'Hydrophobic',
    polar: 'Polar',
    acidic: 'Acidic',
    basic: 'Basic',
    special: 'Special',
    stop: 'Stop',
  },
} as const
