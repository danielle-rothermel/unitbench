import { describe, expect, it } from 'vitest'
import {
  redactBundleReadDiagnostic,
  toBundleReadError,
} from '@/lib/bundle-adapter.server'

describe('bundle read error classification', () => {
  it('identifies an undefined column as a permanent contract mismatch', () => {
    expect(toBundleReadError({ code: '42703', message: 'column "score" does not exist' }).code)
      .toBe('BUNDLE_CONTRACT_INCOMPATIBLE')
  })

  it('keeps SQL syntax and programming errors internal', () => {
    expect(toBundleReadError({ code: '42601', message: 'syntax error at or near "FROM"' }).code)
      .toBe('INTERNAL_READ_ERROR')
    expect(toBundleReadError(new TypeError('cannot read properties of undefined')).code)
      .toBe('INTERNAL_READ_ERROR')
  })

  it('identifies transient connection errors', () => {
    expect(toBundleReadError({ code: 'ECONNREFUSED', message: 'connect ECONNREFUSED' }).code)
      .toBe('DESTINATION_UNAVAILABLE')
  })

  it('keeps unknown errors internal', () => {
    expect(toBundleReadError(new Error('unexpected failure')).code)
      .toBe('INTERNAL_READ_ERROR')
  })

  it('redacts connection URLs and credentials from diagnostics', () => {
    const diagnostic = redactBundleReadDiagnostic(
      'connect postgres://reader:super-secret@db.example/unitbench?token=also-secret password=more-secret',
    )

    expect(diagnostic).not.toContain('super-secret')
    expect(diagnostic).not.toContain('also-secret')
    expect(diagnostic).not.toContain('more-secret')
    expect(diagnostic).toContain('[redacted-url]')
    expect(diagnostic).toContain('password=[redacted]')
  })
})
