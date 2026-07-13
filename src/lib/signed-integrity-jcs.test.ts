import { describe, expect, it } from 'vitest'
import vectors from './signed-integrity-jcs-vectors.json'
import { integrityCanonicalJson } from './bundle-pins.server'

describe('signed-integrity JCS vectors', () => {
  it('matches the committed Python corpus', () => {
    for (const vector of vectors) {
      expect(integrityCanonicalJson(vector.value)).toBe(vector.canonical)
    }
  })

  it.each([1.25, 9_007_199_254_740_992])('rejects %p', value => {
    expect(() => integrityCanonicalJson(value)).toThrow('PINNED_BUNDLE_GONE')
  })
})
