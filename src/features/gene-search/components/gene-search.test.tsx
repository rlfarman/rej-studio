import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

// --- Mocks (hoisted) ---

const speciesRef = { current: 'both' as string }
vi.mock('@/stores/species-store', () => ({
  useSpeciesContext: () => ({
    species: speciesRef.current,
    handleSpeciesChange: vi.fn(),
  }),
}))

const { mockGetBrowserCorpus, favoritesRef, recentsRef } = vi.hoisted(() => ({
  mockGetBrowserCorpus: vi.fn(),
  favoritesRef: { current: [] as unknown[] },
  recentsRef: { current: [] as unknown[] },
}))

vi.mock('../corpus/gene-data-url', () => ({
  getBrowserCorpus: mockGetBrowserCorpus,
  geneDataUrl: () => '/gene-data/sample',
}))

vi.mock('../stores/favorite-genes-store', () => ({
  useFavoriteGenes: () => ({ favoriteGenes: favoritesRef.current }),
}))

vi.mock('../stores/recent-genes-store', () => ({
  useRecentGenes: () => ({
    recentGenes: recentsRef.current,
    addRecentGene: vi.fn(),
  }),
}))

import { geneSearchCopy } from '../copy'
import { GeneSearch } from './gene-search'

const copy = geneSearchCopy.command
const matched = geneSearchCopy.results.matched

const mockSearch = vi.fn()
const mockSimilar = vi.fn()

function gene(
  symbol: string,
  species: string,
  extra: Record<string, unknown> = {},
) {
  return {
    id: `${symbol}-${species}`,
    symbol,
    name: `${symbol} protein`,
    species,
    ...extra,
  }
}

function renderPalette() {
  const rootRoute = createRootRoute({ component: Outlet })
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <GeneSearch />,
  })
  const designRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/design-tool',
    component: () => <div data-testid="design-tool" />,
  })
  const geneRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/genes/$symbol',
    component: () => null,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([homeRoute, designRoute, geneRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

/** The palette's results list. */
function listbox() {
  return screen.getByRole('listbox')
}

/** The palette's group labels, in the order they appear in the listbox. */
function groupOrder() {
  return within(listbox())
    .getAllByText(
      (text) =>
        text === copy.genes ||
        text === copy.favorites ||
        text === copy.recentGenes,
    )
    .map((node) => node.textContent)
}

/**
 * The prerendered, focused search box with text typed into it before the
 * app's JavaScript ran.
 */
function typeBeforeHydration(value: string) {
  const input = document.createElement('input')
  input.id = 'gene-search-input'
  input.value = value
  document.body.appendChild(input)
}

describe('GeneSearch palette', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    favoritesRef.current = []
    recentsRef.current = []
    speciesRef.current = 'both'
    mockSearch.mockResolvedValue({ results: [], truncated: false })
    mockSimilar.mockResolvedValue([])
    mockGetBrowserCorpus.mockReturnValue({
      searchGenes: mockSearch,
      similarGenes: mockSimilar,
      loadTextSearch: vi.fn().mockResolvedValue(null),
    })
  })

  // --- Finding 1: typing before hydration ---

  it('searches for text already typed into the prerendered box', async () => {
    typeBeforeHydration('kras')
    mockSearch.mockResolvedValue({
      results: [gene('KRAS', 'human')],
      truncated: false,
    })

    renderPalette()

    await waitFor(() => expect(mockSearch).toHaveBeenCalled())
    expect(mockSearch.mock.calls[0]?.[0]).toBe('kras')
    // HighlightMatch wraps the matched run, so the symbol spans two nodes.
    expect((await screen.findAllByText('KRAS')).length).toBeGreaterThan(0)
  })

  it('starts empty when nothing was typed', async () => {
    renderPalette()
    // The example-gene hint, not a search.
    expect(await screen.findByText(copy.examplesLabel)).toBeTruthy()
    expect(mockSearch).not.toHaveBeenCalled()
  })

  // --- Finding 3: why a gene matched ---

  it('says why a gene matched', async () => {
    typeBeforeHydration('brac1')
    mockSearch.mockResolvedValue({
      results: [
        gene('BRCA1', 'human', { match: { field: 'alias', typo: true } }),
      ],
      truncated: false,
    })

    renderPalette()

    expect(await screen.findByText(matched.closeAlias)).toBeTruthy()
  })

  // --- Finding 4: human and mouse rows ---

  it('names the species on every gene row', async () => {
    typeBeforeHydration('brca')
    mockSearch.mockResolvedValue({
      results: [gene('BRCA1', 'human'), gene('BRCA1', 'mouse')],
      truncated: false,
    })

    renderPalette()

    await screen.findByText(copy.genes)
    // Scoped to the result rows: the species filter above them is also
    // labelled "Human" and "Mouse".
    const rows = within(listbox())
    expect(rows.getByText('Human')).toBeTruthy()
    expect(rows.getByText('Mouse')).toBeTruthy()
  })

  // --- Finding 6: search results come first while typing ---

  it('puts the search results above favorites and recents while typing', async () => {
    favoritesRef.current = [gene('BRCA2', 'human')]
    recentsRef.current = [gene('BRCA1', 'mouse')]
    typeBeforeHydration('brca')
    mockSearch.mockResolvedValue({
      results: [gene('BRCA1', 'human')],
      truncated: false,
    })

    renderPalette()

    await screen.findByText(copy.genes)
    expect(groupOrder()).toEqual([copy.genes, copy.favorites, copy.recentGenes])
  })

  // The list was capped at 300px with the scrollbar hidden, so rows were cut
  // mid-line with nothing to say more were below.
  it('scrolls the results list visibly instead of clipping it at 300px', async () => {
    favoritesRef.current = [gene('BRCA2', 'human')]

    renderPalette()

    await screen.findByText(copy.favorites)
    const classes = listbox().className
    expect(classes).toContain('overflow-y-auto')
    expect(classes).not.toContain('no-scrollbar')
    expect(classes).not.toContain('max-h-[300px]')
  })

  it('leads with favorites and recents when the box is empty', async () => {
    favoritesRef.current = [gene('TP53', 'human')]
    recentsRef.current = [gene('MYC', 'human')]

    renderPalette()

    await screen.findByText(copy.favorites)
    expect(groupOrder()).toEqual([copy.favorites, copy.recentGenes])
  })

  // --- Finding 7: a failed search is announced ---

  it('announces a failed search to a screen reader', async () => {
    typeBeforeHydration('tp53')
    mockSearch.mockRejectedValue(new Error('offline'))

    renderPalette()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain(geneSearchCopy.searchErrors.network)
    expect(within(alert).getByRole('button', { name: copy.retry })).toBeTruthy()
  })

  // --- Finding 8: the species filter ---

  it('names the species toggles as a group', async () => {
    renderPalette()

    const group = await screen.findByRole('group', { name: copy.speciesLabel })
    expect(
      within(group).getByRole('button', { name: copy.speciesOptions.human }),
    ).toBeTruthy()
  })

  it('returns focus to the search box after a species change', async () => {
    renderPalette()

    const group = await screen.findByRole('group', { name: copy.speciesLabel })
    const human = within(group).getByRole('button', {
      name: copy.speciesOptions.human,
    })
    human.focus()
    expect(document.activeElement).toBe(human)

    fireEvent.click(human)

    expect(document.activeElement).toBe(
      screen.getByRole('combobox', { name: copy.inputAria }),
    )
  })

  it('clears the search on Escape in the inline search', async () => {
    renderPalette()
    const input = await screen.findByRole<HTMLInputElement>('combobox', {
      name: copy.inputAria,
    })
    fireEvent.change(input, { target: { value: 'tp53' } })
    expect(input.value).toBe('tp53')

    fireEvent.keyDown(input, { key: 'Escape' })

    await waitFor(() => expect(input.value).toBe(''))
  })

  // --- Finding 9: the design-tool shortcut is its own option ---

  it('offers the design tool as an option, not a link inside one', async () => {
    typeBeforeHydration('ENST00000269305')
    mockSearch.mockResolvedValue({
      results: [gene('TP53', 'human', { matchedIsoformId: 'ENST00000269305' })],
      truncated: false,
      total: 1,
    })

    renderPalette()

    const row = await screen.findByRole('option', {
      name: copy.customizeRow('ENST00000269305'),
    })
    // The old markup put a Link inside the gene's option, which the arrow
    // keys never reached and no option may contain.
    expect(within(listbox()).queryAllByRole('link')).toHaveLength(0)

    fireEvent.click(row)
    expect(await screen.findByTestId('design-tool')).toBeTruthy()
  })

  // --- Finding 12: what the palette is waiting for ---

  it('waits out the typing debounce before it says it is searching, and names the whole query', async () => {
    typeBeforeHydration('tp53')
    let settle: (value: unknown) => void = () => {}
    mockSearch.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve
      }),
    )

    renderPalette()

    // Nothing yet: a row built from a half-typed query ("Searching for
    // e…") used to flash on every first keystroke.
    expect(screen.queryByRole('status')).toBeNull()

    const status = await screen.findByRole('status')
    expect(status.textContent).toBe(copy.searching('tp53'))
    settle({ results: [], truncated: false, total: 0 })
  })
})
