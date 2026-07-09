import { describe, expect, it } from 'vitest'
import { createRng, intBetween, pick, round } from '@/fixtures/rng'

describe('createRng', () => {
  it('produces the same sequence for the same seed', () => {
    const first = createRng(42)
    const second = createRng(42)
    const firstValues = [first(), first(), first()]
    const secondValues = [second(), second(), second()]
    expect(firstValues).toEqual(secondValues)
  })

  it('produces different sequences for different seeds', () => {
    expect(createRng(1)()).not.toBe(createRng(2)())
  })

  it('stays within [0, 1)', () => {
    const rng = createRng(7)
    for (let i = 0; i < 1000; i += 1) {
      const value = rng()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('intBetween', () => {
  it('stays within the inclusive bounds', () => {
    const rng = createRng(3)
    for (let i = 0; i < 200; i += 1) {
      const value = intBetween(rng, 2, 5)
      expect(value).toBeGreaterThanOrEqual(2)
      expect(value).toBeLessThanOrEqual(5)
      expect(Number.isInteger(value)).toBe(true)
    }
  })
})

describe('pick', () => {
  it('returns an element of the input', () => {
    const rng = createRng(11)
    const values = ['a', 'b', 'c'] as const
    for (let i = 0; i < 50; i += 1) {
      expect(values).toContain(pick(rng, values))
    }
  })
})

describe('round', () => {
  it('rounds to the requested decimals', () => {
    expect(round(0.123456, 4)).toBe(0.1235)
  })
})
