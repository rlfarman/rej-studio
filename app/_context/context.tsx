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
  payload: Isomorph[]
}

interface LoadAction {
  type: 'load'
  payload: Isomorph[]
}

interface FilterAction {
  type: 'filter'
  payload: {
    key: FilterKey
    value: boolean
  }
}

interface InitialState {
  selected: Isomorph[]
  isomorphs: Isomorph[]
  initialIsomorphs: Isomorph[]
  query: string
}

type DispatchActions = QueryAction | SelectAction | LoadAction

export const StateContext = createContext<InitialState>({
  selected: [],
  initialIsomorphs: [],
  isomorphs: [],
  query: '',
})

export const DispatchContext = createContext<Dispatch<DispatchActions>>(
  () => null
)

export function useIsomorphs() {
  return useContext(StateContext)
}

export function useIsomorphsDispatch() {
  return useContext(DispatchContext)
}

function parseString(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '')
}

function getMatch(isomorph: Isomorph, query: string) {
  return (
    parseString(isomorph.searchName).includes(parseString(query)) ||
    parseString(isomorph.name).includes(parseString(query))
  )
}

function isomorphsReducer(state: InitialState, action: DispatchActions) {
  switch (action.type) {
    case 'query': {
      const payload = action.payload
      return {
        ...state,
        isomorphs: state.initialIsomorphs.filter((isomorph) =>
          getMatch(isomorph, payload)
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
        isomorphs: payload,
        initialIsomorphs: payload,
      }
    }
  }
}

interface IsomorphProviderProperties {
  children: React.ReactNode
}

export function Provider({ children }: IsomorphProviderProperties) {
  const [state, dispatch] = useReducer(isomorphsReducer, {
    selected: [],
    initialIsomorphs: [],
    isomorphs: [],
    query: '',
  })

  useEffect(() => {
    fetch('/data/database.csv')
      .then((response) => response.text())
      .then((v) =>
        Papa.parse<Isomorph>(v, {
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
