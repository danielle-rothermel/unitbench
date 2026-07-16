import { describe, expect, it } from 'vitest'
import { resolveFacades } from './gen-api.mjs'

describe('resolveFacades', () => {
  it('targets the documented facade worktree by default', () => {
    expect(resolveFacades([], process.env)).toEqual([
      expect.objectContaining({
        name: 'dr-providers',
        sourceDir: '../dr-providers-serve',
      }),
    ])
  })

  it('honors facade worktree environment overrides', () => {
    expect(
      resolveFacades(['dr-providers'], {
        ...process.env,
        DR_PROVIDERS_SERVE_DIR: '/tmp/dr-providers',
      }),
    ).toEqual([
      expect.objectContaining({ sourceDir: '/tmp/dr-providers' }),
    ])
  })

  it('retains explicit single-facade generation', () => {
    expect(resolveFacades(['dr-providers'], process.env)).toHaveLength(1)
  })
})
