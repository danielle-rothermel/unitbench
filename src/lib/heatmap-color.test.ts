import { describe, expect, it } from 'vitest'
import {
  HEAT_HIGH,
  HEAT_LOW,
  HEAT_TEXT_DARK,
  contrastRatio,
  mixHeat,
  rgbCss,
} from '@/lib/heatmap-color'

describe('mixHeat', () => {
  it('returns the ramp endpoints at t=0 and t=1', () => {
    expect(mixHeat(0)).toEqual(HEAT_LOW)
    expect(mixHeat(1)).toEqual(HEAT_HIGH)
  })

  it('clamps t outside [0, 1]', () => {
    expect(mixHeat(-3)).toEqual(HEAT_LOW)
    expect(mixHeat(7)).toEqual(HEAT_HIGH)
  })
})

describe('contrast guarantee', () => {
  it('keeps dark text at >=4.5:1 against every ramp background', () => {
    for (let step = 0; step <= 50; step += 1) {
      const background = mixHeat(step / 50)
      expect(
        contrastRatio(background, HEAT_TEXT_DARK),
        `t=${step / 50} background ${rgbCss(background)}`,
      ).toBeGreaterThanOrEqual(4.5)
    }
  })
})
