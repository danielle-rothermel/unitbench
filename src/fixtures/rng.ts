/** Deterministic PRNG (mulberry32) so fixtures are stable for a given seed. */
export type Rng = () => number

export function createRng(seed: number): Rng {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function pick<T>(rng: Rng, values: readonly T[]): T {
  return values[Math.floor(rng() * values.length)]
}

export function intBetween(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

export function floatBetween(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min)
}

export function chance(rng: Rng, probability: number): boolean {
  return rng() < probability
}

export function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}
