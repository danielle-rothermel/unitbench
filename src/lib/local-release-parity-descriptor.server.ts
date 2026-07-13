import 'server-only'

import { readFile } from 'node:fs/promises'
import type { ReleaseParityLocal } from '@/lib/release-parity-descriptor.server'
import { parseReleaseParityDescriptor } from '@/lib/release-parity-descriptor.server'

export type LocalReleaseParityDescriptor = Readonly<{
  schema_version: 2
  run_id: string
  fixture_sha256: string
  fixture_prediction_id: string
  source_schema: string
  public_key_ring_environment: 'WHETSTONE_BUNDLE_INTEGRITY_PUBLIC_KEY_RING'
  public_key_ids: readonly string[]
  analysis: ReleaseParityLocal
  detail: ReleaseParityLocal
}>

const identifier = /^[A-Za-z_][A-Za-z0-9_]*$/
const sha256 = /^[a-f0-9]{64}$/

function fail(message: string): never { throw new TypeError(`Invalid Whetstone local release parity evidence: ${message}`) }
function record(value: unknown, name: string): Record<string, unknown> {
  if (value === null || Array.isArray(value) || typeof value !== 'object') fail(`${name} must be an object`)
  return value as Record<string, unknown>
}

/** Parses the local-only producer contract without accepting a remote fallback. */
export function parseLocalReleaseParityDescriptor(input: string): LocalReleaseParityDescriptor {
  let value: unknown
  try { value = JSON.parse(input) } catch { return fail('descriptor is not JSON') }
  const data = record(value, 'descriptor')
  const expected = ['schema_version', 'run_id', 'fixture_sha256', 'fixture_prediction_id', 'source_schema', 'public_key_ring_environment', 'public_key_ids', 'analysis', 'detail']
  if (Object.keys(data).length !== expected.length || expected.some(key => !(key in data))) fail('descriptor has unknown or missing fields')
  if (data.schema_version !== 2 || typeof data.run_id !== 'string' || !/^[a-f0-9]{32}$/.test(data.run_id)) fail('invalid run identity')
  if (typeof data.fixture_sha256 !== 'string' || !sha256.test(data.fixture_sha256) || data.fixture_prediction_id !== `release_parity_${data.run_id}_prediction_small_positive` || data.source_schema !== `whetstone_v6_release_${data.run_id}`) fail('invalid fixture identity')
  if (data.public_key_ring_environment !== 'WHETSTONE_BUNDLE_INTEGRITY_PUBLIC_KEY_RING' || !Array.isArray(data.public_key_ids) || data.public_key_ids.length === 0 || data.public_key_ids.some(key => typeof key !== 'string' || !identifier.test(key))) fail('invalid public key ring boundary')
  const publicRing = process.env.UNITBENCH_BUNDLE_INTEGRITY_PUBLIC_KEYS
  if (!publicRing) fail('UNITBENCH_BUNDLE_INTEGRITY_PUBLIC_KEYS is required')
  let ring: Record<string, unknown>
  try { ring = record(JSON.parse(publicRing), 'public key ring') } catch { return fail('invalid public key ring') }
  if (data.public_key_ids.some(key => typeof ring[key] !== 'string' || !(ring[key] as string).length)) fail('public key ring does not satisfy producer key IDs')
  // Reuse the hardened v1 local-plane parser by embedding inert remote-shaped
  // twins; its output is discarded and only validates local fields/inventories.
  const normalized = (plane: unknown) => {
    const source = record(plane, 'plane')
    const counts = record(source.member_counts, 'plane.member_counts')
    return { ...source, member_counts: Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, typeof value === 'number' && value >= 0 ? Math.max(1, value) : value])) }
  }
  const remote = (plane: unknown) => ({ destination_id: 'local_evidence', bundle_key: record(plane, 'plane').bundle, pin: record(plane, 'plane').pin, snapshot_seq: record(plane, 'plane').snapshot_seq, members: record(plane, 'plane').members, member_counts: record(plane, 'plane').member_counts, member_checksums: record(plane, 'plane').member_checksums })
  const analysis = normalized(data.analysis)
  const detail = normalized(data.detail)
  const validated = parseReleaseParityDescriptor(JSON.stringify({ schema_version: 1, run_id: data.run_id, fixture_sha256: data.fixture_sha256, fixture_prediction_id: data.fixture_prediction_id, source_schema: data.source_schema, analysis: { local: analysis, remote: remote(analysis) }, detail: { local: detail, remote: remote(detail) } }))
  return { schema_version: 2, run_id: data.run_id, fixture_sha256: data.fixture_sha256, fixture_prediction_id: data.fixture_prediction_id, source_schema: data.source_schema, public_key_ring_environment: data.public_key_ring_environment, public_key_ids: data.public_key_ids as string[], analysis: validated.analysis.local, detail: validated.detail.local }
}

export async function loadLocalReleaseParityDescriptor(path: string): Promise<LocalReleaseParityDescriptor> {
  return parseLocalReleaseParityDescriptor(await readFile(path, 'utf8'))
}
