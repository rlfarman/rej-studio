'use client'
import {
  Dispatch,
  createContext,
  useContext,
  useEffect,
  useReducer,
} from 'react'
import Papa from 'papaparse'

const HEADERS_MAP = {
  ID: 'id',
  Symbol: 'symbol',
  Name: 'name',
  ENSG: 'ensg',
  ENST: 'enst',
  Chromosome: 'chromosome',
  Length: 'length',
  'log10(Length)': 'log10Length',
  'Disease Associated': 'isDiseaseAssociated',
  Oversized: 'isOversized',
  'Search Name': 'searchName',
  Species: 'species',
  path_CDS: 'pathCDS',
  path_REJ_N: 'pathREJN',
  path_REJ_C: 'pathREJC',
}

type FilterKey = 'diseaseAssociated'

interface QueryAction {
  type: 'query'
  payload: string
}

interface SelectAction {
  type: 'select'
  payload: Gene[]
}

interface LoadAction {
  type: 'load'
  payload: Gene[]
}

interface FilterAction {
  type: 'filter'
  payload: {
    key: FilterKey
    value: boolean
  }
}

interface InitialState {
  selected: Gene[]
  genes: Gene[]
  initialGenes: Gene[]
  query: string
}

type DispatchActions = QueryAction | SelectAction | LoadAction

export const StateContext = createContext<InitialState>({
  selected: [],
  initialGenes: [],
  genes: [],
  query: '',
})

export const DispatchContext = createContext<Dispatch<DispatchActions>>(
  () => null
)

export function useGenes() {
  return useContext(StateContext)
}

export function useGenesDispatch() {
  return useContext(DispatchContext)
}

function parseString(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '')
}

function getMatch(gene: Gene, query: string) {
  return (
    parseString(gene.searchName).includes(parseString(query)) ||
    parseString(gene.name).includes(parseString(query))
  )
}

function genesReducer(state: InitialState, action: DispatchActions) {
  switch (action.type) {
    case 'query': {
      const payload = action.payload
      return {
        ...state,
        genes: state.initialGenes.filter((gene) => getMatch(gene, payload)),
        query: payload,
      }
    }
    case 'select': {
      const payload = action.payload
      return {
        ...state,
        selected: payload,
      }
    }
    case 'load': {
      const payload = action.payload
      return {
        ...state,
        genes: payload,
        initialGenes: payload,
      }
    }
  }
}

interface GeneProviderProperties {
  children: React.ReactNode
}

export function Provider({ children }: GeneProviderProperties) {
  const [state, dispatch] = useReducer(genesReducer, {
    selected: [],
    initialGenes: [],
    genes: [],
    query: '',
  })

  useEffect(() => {
    fetch('/data/database.csv')
      .then((response) => response.text())
      .then((v) =>
        Papa.parse<Gene>(v, {
          header: true,
          dynamicTyping: true,
          transformHeader(header: keyof typeof HEADERS_MAP, index) {
            return HEADERS_MAP[header]
          },
          complete(results, file) {
            dispatch({
              type: 'load',
              payload: results.data,
            })
          },
        })
      )
      .catch((err) => console.log(err))
  }, [])

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>
        {children}
      </DispatchContext.Provider>
    </StateContext.Provider>
  )
}
