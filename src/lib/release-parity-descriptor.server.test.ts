import { describe, expect, it } from 'vitest'
import { parseReleaseParityCleanupProof, parseReleaseParityDescriptor } from '@/lib/release-parity-descriptor.server'
import { ANALYSIS_BUNDLE_MEMBERS, DETAIL_BUNDLE_MEMBERS } from '@/lib/bundle-contract'

const checksum = 'a'.repeat(64)
const members = (names: readonly string[]) => Object.fromEntries(names.map(name => [name, `main.${name}`]))
const counts = (names: readonly string[]) => Object.fromEntries(names.map(name => [name, 1]))
const checksums = (names: readonly string[]) => Object.fromEntries(names.map(name => [name, checksum]))
const plane = (names: readonly string[], key: string, local: boolean) => local ? { path: `${key}.duckdb`, bundle: key, pin: { pin_id: `${key}-pin`, bundle_id: `${key}-bundle`, expires_at_ms: 1 }, snapshot_seq: 1, members: members(names), member_counts: counts(names), member_checksums: checksums(names) } : { destination_id: `${key}-destination`, bundle_key: key, pin: { pin_id: `${key}-pin`, bundle_id: `${key}-bundle`, expires_at_ms: 1 }, snapshot_seq: 1, members: members(names), member_counts: counts(names), member_checksums: checksums(names) }
const fixture = () => ({ schema_version: 1, run_id: 'run', fixture_sha256: checksum, source_schema: 'fixture_source', analysis: { local: plane(ANALYSIS_BUNDLE_MEMBERS, 'whetstone-analysis', true), remote: plane(ANALYSIS_BUNDLE_MEMBERS, 'whetstone-analysis', false) }, detail: { local: plane(DETAIL_BUNDLE_MEMBERS, 'whetstone-detail', true), remote: plane(DETAIL_BUNDLE_MEMBERS, 'whetstone-detail', false) } })

describe('Whetstone parity descriptor boundary', () => {
  it('accepts only the exact producer descriptor', () => expect(parseReleaseParityDescriptor(JSON.stringify(fixture())).analysis.remote.pin.bundle_id).toBe('whetstone-analysis-bundle'))
  it.each([
    ['unknown field', (value: Record<string, unknown>) => ({ ...value, token: 'nope' })],
    ['URL value', (value: Record<string, unknown>) => ({ ...value, run_id: 'postgres://secret' })],
    ['missing member', (value: Record<string, unknown>) => { delete ((value.analysis as { remote: { members: Record<string, string> } }).remote.members.predictions); return value }],
    ['empty member', (value: Record<string, unknown>) => {
      const analysis = value.analysis as { remote: { member_counts: Record<string, number> } }
      analysis.remote.member_counts.predictions = 0
      return value
    }],
    ['identity mismatch', (value: Record<string, unknown>) => {
      const detail = value.detail as { local: { snapshot_seq: number } }
      detail.local.snapshot_seq = 2
      return value
    }],
  ])('rejects %s', (_name, mutate) => expect(() => parseReleaseParityDescriptor(JSON.stringify(mutate(fixture())))).toThrow())
  it('requires a separate zero-state cleanup proof after querying', () => {
    const descriptor = parseReleaseParityDescriptor(JSON.stringify(fixture()))
    const proof = { schema_version: 1, run_id: 'run', source_schema_absent: true, local_files_absent: true, destinations: { 'whetstone-analysis-destination': { state_rows: 0 }, 'whetstone-detail-destination': { pin_rows: 0 } } }
    expect(() => parseReleaseParityCleanupProof(JSON.stringify(proof), descriptor)).not.toThrow()
    expect(() => parseReleaseParityCleanupProof(JSON.stringify({ ...proof, local_files_absent: false }), descriptor)).toThrow()
  })
})
