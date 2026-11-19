import { describe, expect, it } from 'vite-plus/test'
import { render } from '@testing-library/react'
import { HighlightMatch } from './highlight-match'

const marks = (text: string, query: string) =>
  Array.from(
    render(
      <span>
        <HighlightMatch text={text} query={query} />
      </span>,
    ).container.querySelectorAll('mark'),
  ).map((m) => m.textContent)

const text = (node: HTMLElement) => node.textContent

describe('HighlightMatch', () => {
  it('marks every word the query starts', () => {
    expect(marks('Kinase kinase', 'kinase')).toEqual(['Kinase', 'kinase'])
    expect(marks('insulin receptor', 'insulin receptor')).toEqual([
      'insulin',
      'receptor',
    ])
    // A prefix of a word, as name search matches one.
    expect(marks('breast cancer 1', 'canc')).toEqual(['canc'])
  })

  it('does not mark a run inside a word', () => {
    // Search matched the symbol or a word of the name by its start; marking
    // every "a" in "receptor" claimed a match that was never made.
    expect(marks('aaaa', 'aa')).toEqual(['aa'])
    expect(marks('receptor', 'a')).toEqual([])
    expect(marks('alpha receptor', 'a')).toEqual(['a'])
  })

  it('marks a hyphenated query against the plain symbol', () => {
    expect(marks('MYC', 'c-myc')).toEqual(['MYC'])
  })

  it('treats regex characters in the query as text, not a pattern', () => {
    // The query is never compiled, so a stray bracket cannot throw or
    // match more than the word it names.
    expect(marks('C(1)A', '(1)')).toEqual(['1'])
    expect(marks('TP53', '.*')).toEqual([])
  })

  it('renders plain text for an empty query', () => {
    expect(marks('TP53', '  ')).toEqual([])
  })

  it('keeps the whole text, marked or not', () => {
    const { container } = render(
      <span>
        <HighlightMatch text="breast cancer 1" query="cancer" />
      </span>,
    )
    expect(text(container.firstChild as HTMLElement)).toBe('breast cancer 1')
  })
})
