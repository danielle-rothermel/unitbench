import { describe, expect, it } from 'vitest'
import { normalizeModelLabel } from '@/lib/canonical-model'

describe('normalizeModelLabel', () => {
  it('returns direct model labels unchanged', () => {
    expect(normalizeModelLabel('openai/gpt-5.4-nano')).toBe('openai/gpt-5.4-nano')
  })

  it('collapses matching enc-dec pairs', () => {
    expect(normalizeModelLabel('openai/gpt-5.4-nano -> openai/gpt-5.4-nano')).toBe(
      'openai/gpt-5.4-nano',
    )
  })

  it('keeps distinct encoder and decoder labels', () => {
    expect(normalizeModelLabel('openai/a -> openai/b')).toBe('openai/a -> openai/b')
  })
})
