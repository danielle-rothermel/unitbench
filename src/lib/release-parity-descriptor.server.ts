import 'server-only'

import { readFile } from 'node:fs/promises'
import {
  ANALYSIS_BUNDLE_KEY,
  ANALYSIS_BUNDLE_MEMBERS,
  DETAIL_BUNDLE_KEY,
  DETAIL_BUNDLE_MEMBERS,
  type BundlePlane,
} from '@/lib/bundle-contract'

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

export type ReleaseParityPin = Readonly<{ pin_id: string; bundle_id: string; expires_at_ms: number }>
export type ReleaseParityLocal = Readonly<{
  path: string; bundle: string; pin: ReleaseParityPin; snapshot_seq: number
  members: Readonly<Record<string, string>>; member_counts: Readonly<Record<string, number>>
  member_checksums: Readonly<Record<string, string>>
}>
export type ReleaseParityRemote = Readonly<{
  destination_id: string; bundle_key: string; pin: ReleaseParityPin; snapshot_seq: number
  members: Readonly<Record<string, string>>; member_counts: Readonly<Record<string, number>>
  member_checksums: Readonly<Record<string, string>>
}>
export type ReleaseParityDescriptor = Readonly<{
  schema_version: 1; run_id: string; fixture_sha256: string; fixture_prediction_id: string; source_schema: string
  analysis: Readonly<{ local: ReleaseParityLocal; remote: ReleaseParityRemote }>
  detail: Readonly<{ local: ReleaseParityLocal; remote: ReleaseParityRemote }>
}>
export type ReleaseParityCleanupProof = Readonly<{
  schema_version: 1; run_id: string; source_schema_absent: boolean; local_files_absent: boolean
  destinations: Readonly<Record<string, Readonly<Record<string, number>>>>
}>

const SECRET = /token|password|secret|dsn|url|authorization/i
const SHA256 = /^[a-f0-9]{64}$/
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/

function fail(message: string): never { throw new TypeError(`Invalid Whetstone release parity evidence: ${message}`) }
function record(value: Json, name: string): Record<string, Json> {
  if (value === null || Array.isArray(value) || typeof value !== 'object') fail(`${name} must be an object`)
  return value
}
function exact(value: Record<string, Json>, keys: readonly string[], name: string): void {
  if (Object.keys(value).length !== keys.length || keys.some(key => !(key in value))) fail(`${name} has unknown or missing fields`)
}
function string(value: Json | undefined, name: string): string {
  if (typeof value !== 'string' || value.length === 0) fail(`${name} must be a non-empty string`)
  return value
}
function integer(value: Json | undefined, name: string, positive = false): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || (positive && value === 0)) fail(`${name} must be a ${positive ? 'positive' : 'non-negative'} integer`)
  return value
}
function rejectSecrets(value: Json): void {
  if (typeof value === 'string') { if (value.includes('://')) fail('URLs are not allowed'); return }
  if (Array.isArray(value)) { value.forEach(rejectSecrets); return }
  if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
    if (SECRET.test(key)) fail('secret-shaped fields are not allowed')
    rejectSecrets(child)
  }
}
function pin(value: Json, name: string): ReleaseParityPin {
  const data = record(value, name); exact(data, ['pin_id', 'bundle_id', 'expires_at_ms'], name)
  return { pin_id: string(data.pin_id, `${name}.pin_id`), bundle_id: string(data.bundle_id, `${name}.bundle_id`), expires_at_ms: integer(data.expires_at_ms, `${name}.expires_at_ms`) }
}
function members(value: Json, expected: readonly string[], name: string): Readonly<Record<string, string>> {
  const data = record(value, name); exact(data, expected, name)
  return Object.fromEntries(expected.map(key => {
    const physical = string(data[key], `${name}.${key}`)
    if (!physical.split('.').every(part => IDENTIFIER.test(part))) fail(`${name}.${key} is not a safe physical table`)
    return [key, physical]
  }))
}
function counts(value: Json, expected: readonly string[], name: string): Readonly<Record<string, number>> {
  const data = record(value, name); exact(data, expected, name)
  return Object.fromEntries(expected.map(key => [key, integer(data[key], `${name}.${key}`, true)]))
}
function checksums(value: Json, expected: readonly string[], name: string): Readonly<Record<string, string>> {
  const data = record(value, name); exact(data, expected, name)
  return Object.fromEntries(expected.map(key => {
    const checksum = string(data[key], `${name}.${key}`); if (!SHA256.test(checksum)) fail(`${name}.${key} must be SHA-256`); return [key, checksum]
  }))
}
function plane(value: Json, expected: readonly string[], key: string, local: boolean, name: string): ReleaseParityLocal | ReleaseParityRemote {
  const data = record(value, name)
  exact(data, local ? ['path', 'bundle', 'pin', 'snapshot_seq', 'members', 'member_counts', 'member_checksums'] : ['destination_id', 'bundle_key', 'pin', 'snapshot_seq', 'members', 'member_counts', 'member_checksums'], name)
  const common = { pin: pin(data.pin, `${name}.pin`), snapshot_seq: integer(data.snapshot_seq, `${name}.snapshot_seq`), members: members(data.members, expected, `${name}.members`), member_counts: counts(data.member_counts, expected, `${name}.member_counts`), member_checksums: checksums(data.member_checksums, expected, `${name}.member_checksums`) }
  return local ? { path: string(data.path, `${name}.path`), bundle: string(data.bundle, `${name}.bundle`), ...common } : { destination_id: string(data.destination_id, `${name}.destination_id`), bundle_key: string(data.bundle_key, `${name}.bundle_key`), ...common }
}

export function parseReleaseParityDescriptor(input: string): ReleaseParityDescriptor {
  let json: Json
  try { json = JSON.parse(input) as Json } catch { return fail('descriptor is not JSON') }
  rejectSecrets(json)
  const data = record(json, 'descriptor'); exact(data, ['schema_version', 'run_id', 'fixture_sha256', 'fixture_prediction_id', 'source_schema', 'analysis', 'detail'], 'descriptor')
  if (data.schema_version !== 1) fail('unsupported schema_version')
  const descriptor = {
    schema_version: 1 as const, run_id: string(data.run_id, 'run_id'), fixture_sha256: string(data.fixture_sha256, 'fixture_sha256'), fixture_prediction_id: string(data.fixture_prediction_id, 'fixture_prediction_id'), source_schema: string(data.source_schema, 'source_schema'),
    analysis: record(data.analysis, 'analysis'), detail: record(data.detail, 'detail'),
  }
  if (!SHA256.test(descriptor.fixture_sha256) || !IDENTIFIER.test(descriptor.source_schema) || descriptor.fixture_prediction_id !== `release_parity_${descriptor.run_id}_prediction_small_positive`) fail('invalid fixture identity')
  const analysis = { local: plane(descriptor.analysis.local, ANALYSIS_BUNDLE_MEMBERS, ANALYSIS_BUNDLE_KEY, true, 'analysis.local') as ReleaseParityLocal, remote: plane(descriptor.analysis.remote, ANALYSIS_BUNDLE_MEMBERS, ANALYSIS_BUNDLE_KEY, false, 'analysis.remote') as ReleaseParityRemote }
  const detail = { local: plane(descriptor.detail.local, DETAIL_BUNDLE_MEMBERS, DETAIL_BUNDLE_KEY, true, 'detail.local') as ReleaseParityLocal, remote: plane(descriptor.detail.remote, DETAIL_BUNDLE_MEMBERS, DETAIL_BUNDLE_KEY, false, 'detail.remote') as ReleaseParityRemote }
  for (const [name, value, key] of [['analysis', analysis, ANALYSIS_BUNDLE_KEY], ['detail', detail, DETAIL_BUNDLE_KEY]] as const) {
    if (value.local.bundle !== key || value.remote.bundle_key !== key || value.local.pin.bundle_id !== value.remote.pin.bundle_id || value.local.snapshot_seq !== value.remote.snapshot_seq) fail(`${name} plane identities disagree`)
  }
  return { ...descriptor, analysis, detail }
}

export async function loadReleaseParityDescriptor(path: string): Promise<ReleaseParityDescriptor> { return parseReleaseParityDescriptor(await readFile(path, 'utf8')) }
export function descriptorPlane(descriptor: ReleaseParityDescriptor, plane: BundlePlane) { return descriptor[plane] }

export function parseReleaseParityCleanupProof(input: string, descriptor: ReleaseParityDescriptor): ReleaseParityCleanupProof {
  let json: Json; try { json = JSON.parse(input) as Json } catch { return fail('cleanup proof is not JSON') }; rejectSecrets(json)
  const data = record(json, 'cleanup proof'); exact(data, ['schema_version', 'run_id', 'source_schema_absent', 'local_files_absent', 'destinations'], 'cleanup proof')
  if (data.schema_version !== 1 || data.run_id !== descriptor.run_id || data.source_schema_absent !== true || data.local_files_absent !== true) fail('cleanup proof is not zero-state for this run')
  const destinations = record(data.destinations, 'cleanup proof.destinations')
  const expected = [descriptor.analysis.remote.destination_id, descriptor.detail.remote.destination_id]
  exact(destinations, expected, 'cleanup proof.destinations')
  for (const [destination, facts] of Object.entries(destinations)) for (const [name, value] of Object.entries(record(facts, `cleanup proof.destinations.${destination}`))) if (integer(value, name) !== 0) fail('cleanup proof has remaining state')
  return { schema_version: 1, run_id: descriptor.run_id, source_schema_absent: true, local_files_absent: true, destinations: destinations as ReleaseParityCleanupProof['destinations'] }
}
