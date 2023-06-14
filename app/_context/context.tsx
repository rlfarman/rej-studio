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
  ENSG: 'ENSG',
  ENST: 'ENST',
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
  payload: FuckFace[]
}

interface LoadAction {
  type: 'load'
  payload: Isoform[]
}

interface FilterAction {
  type: 'filter'
  payload: {
    key: FilterKey
    value: boolean
  }
}

interface InitialState {
  selected: Isoform[]
  isoforms: Isoform[]
  initialIsoforms: Isoform[]
  query: string
}

type DispatchActions = QueryAction | SelectAction | LoadAction

export const StateContext = createContext<InitialState>({
  selected: [],
  initialIsoforms: [],
  isoforms: [],
  query: '',
})

export const DispatchContext = createContext<Dispatch<DispatchActions>>(
  () => null
)

export function useIsoforms() {
  return useContext(StateContext)
}

export function useIsoformsDispatch() {
  return useContext(DispatchContext)
}

function parseString(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '')
}

function getMatch(isoform: Isoform, query: string) {
  return (
    parseString(isoform.searchName).includes(parseString(query)) ||
    parseString(isoform.name).includes(parseString(query))
  )
}

function isoformsReducer(state: InitialState, action: DispatchActions) {
  switch (action.type) {
    case 'query': {
      const payload = action.payload
      return {
        ...state,
        isoforms: state.initialIsoforms.filter((isoform) =>
          getMatch(isoform, payload)
        ),
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
        isoforms: payload,
        initialIsoforms: payload,
      }
    }
  }
}

interface IsoformProviderProperties {
  children: React.ReactNode
}

export function Provider({ children }: IsoformProviderProperties) {
  const [state, dispatch] = useReducer(isoformsReducer, {
    selected: [],
    initialIsoforms: [],
    isoforms: [],
    query: '',
  })

  useEffect(() => {
    fetch('/data/database.csv')
      .then((response) => response.text())
      .then((v) =>
        Papa.parse<Isoform>(v, {
          header: true,
          dynamicTyping: true,
          transformHeader(header: keyof typeof HEADERS_MAP, index) {
            return HEADERS_MAP[header] ?? header
          },
          complete(results, file) {
            dispatch({
              type: 'load',
              payload: results.data,
            })
          },
        })
      )
      .catch((err) => console.error(err))
  }, [])

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>
        {children}
      </DispatchContext.Provider>
    </StateContext.Provider>
  )
}
