import { describe, expect, it } from 'vitest'
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

describe('HighlightMatch', () => {
  it('marks every occurrence, including adjacent ones', () => {
    expect(marks('aaaa', 'aa')).toEqual(['aa', 'aa'])
    expect(marks('Kinase kinase', 'kinase')).toEqual(['Kinase', 'kinase'])
  })

  it('treats regex characters in the query literally', () => {
    expect(marks('C(1)A', '(1)')).toEqual(['(1)'])
  })

  it('renders plain text for an empty query', () => {
    expect(marks('TP53', '  ')).toEqual([])
  })
})
