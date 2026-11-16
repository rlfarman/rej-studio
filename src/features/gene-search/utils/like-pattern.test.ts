import { describe, expect, it } from 'vitest'
import { escapeLikePattern } from './like-pattern'

describe('escapeLikePattern', () => {
  it('leaves ordinary input alone', () => {
    expect(escapeLikePattern('brca1')).toBe('brca1')
  })

  it('escapes % and _', () => {
    expect(escapeLikePattern('100%_x')).toBe('100\\%\\_x')
  })

  it('escapes the escape character itself', () => {
    expect(escapeLikePattern('a\\b')).toBe('a\\\\b')
  })
})
