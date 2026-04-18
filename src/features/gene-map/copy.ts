export const copy = {
  backToGene: (symbol: string) => `Back to ${symbol}`,
  layers: {
    heading: 'Layers',
    gc: 'GC content',
    suitability: 'Design suitability',
    cpg: 'CpG islands',
    restriction: 'Restriction sites',
  },
  zoom: {
    in: 'Zoom in',
    out: 'Zoom out',
    fit: 'Fit gene',
  },
  status: {
    bases: (n: number) => `${n.toLocaleString()} bp`,
    bpp: (bpp: number) =>
      bpp < 1 ? `${(1 / bpp).toFixed(1)} px/bp` : `${bpp.toFixed(1)} bp/px`,
    position: (start: number, end: number) =>
      `${start.toLocaleString()}–${end.toLocaleString()}`,
  },
  shortcutsHint: '+/- zoom · ←/→ pan · 0 fit',
  fallback: {
    noWebGL:
      'WebGL2 unavailable — rendering fallback view. Full viewer requires a modern browser.',
  },
  noData: {
    title: 'No sequence to display',
    body: 'This isoform has no coding sequence stored.',
  },
}
