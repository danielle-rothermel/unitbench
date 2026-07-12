import { describe, expect, it } from 'vitest'
import { resolveFacades } from './gen-api.mjs'

describe('resolveFacades', () => {
  it('targets both documented facade worktrees by default', () => {
    expect(resolveFacades([], process.env)).toEqual([
      expect.objectContaining({ name: 'dr-code', sourceDir: '../dr-code-serve' }),
      expect.objectContaining({
        name: 'dr-providers',
        sourceDir: '../dr-providers-serve',
      }),
    ])
  })

  it('honors facade worktree environment overrides', () => {
    expect(
      resolveFacades(['dr-code', 'dr-providers'], {
        ...process.env,
        DR_CODE_SERVE_DIR: '/tmp/dr-code',
        DR_PROVIDERS_SERVE_DIR: '/tmp/dr-providers',
      }),
    ).toEqual([
      expect.objectContaining({ sourceDir: '/tmp/dr-code' }),
      expect.objectContaining({ sourceDir: '/tmp/dr-providers' }),
    ])
  })

  it('retains explicit single-facade generation', () => {
    expect(resolveFacades(['dr-code'], process.env)).toHaveLength(1)
  })
})
