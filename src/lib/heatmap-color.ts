export type Rgb = { r: number; g: number; b: number }

// Light-mode heat ramp. Endpoints are chosen so every interpolated
// background keeps a relative luminance high enough that dark text
// (--text-primary, oklch(0.25 0.028 220) ≈ rgb(17, 37, 43), luminance
// ≈ 0.016) always reaches WCAG AA 4.5:1 — worst case along the ramp is
// ≈ 7.4:1. Do not darken these without re-checking the contrast test.
export const HEAT_LOW: Rgb = { r: 233, g: 158, b: 150 }
export const HEAT_HIGH: Rgb = { r: 141, g: 211, b: 158 }
export const HEAT_TEXT_DARK: Rgb = { r: 17, g: 37, b: 43 }
export const HEAT_TEXT_DARK_CSS = 'var(--text-primary)'

export function rgbCss(rgb: Rgb): string {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
}

export function mixHeat(t: number): Rgb {
  const clamped = Math.max(0, Math.min(1, t))
  const channel = (low: number, high: number) =>
    Math.round(low + (high - low) * clamped)
  return {
    r: channel(HEAT_LOW.r, HEAT_HIGH.r),
    g: channel(HEAT_LOW.g, HEAT_HIGH.g),
    b: channel(HEAT_LOW.b, HEAT_HIGH.b),
  }
}

export function relativeLuminance(rgb: Rgb): number {
  const linear = (value: number) => {
    const scaled = value / 255
    return scaled <= 0.04045
      ? scaled / 12.92
      : Math.pow((scaled + 0.055) / 1.055, 2.4)
  }
  return (
    0.2126 * linear(rgb.r) + 0.7152 * linear(rgb.g) + 0.0722 * linear(rgb.b)
  )
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
