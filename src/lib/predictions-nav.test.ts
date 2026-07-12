import { describe, expect, it } from 'vitest'
import { predictionsTableHref } from '@/lib/predictions-nav'

describe('prediction navigation', () => {
  it('targets the pinned Analysis predictions table', () => {
    expect(predictionsTableHref({ model: 'openai/test' })).toBe(
      '/tables/predictions?model=openai%2Ftest',
    )
  })
})
