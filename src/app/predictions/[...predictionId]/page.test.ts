import { describe, expect, it } from 'vitest'
import { predictionIdFromSegments } from './page'

describe('predictionIdFromSegments', () => {
  it('reconstructs a slash-delimited dashboard prediction ID', () => {
    expect(predictionIdFromSegments(['dr-dspy', 'encdec', 'prediction', 'abc'])).toBe(
      'dr-dspy/encdec/prediction/abc',
    )
  })
})
