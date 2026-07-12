import { dirname, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { withResolvedParityBundles } from '@/lib/bundle-adapter.server'
import {
  resolveOnlyLocalAdapter,
  resolveOnlyLocalBundle,
  resolveOnlyPinnedBundle,
  resolveOnlyRemoteAdapter,
} from '@/lib/bundle-pins.server'
import type { PublicationDatabase } from '@/lib/bundle-pins.server'
import { executeFrozenParityCase, FROZEN_PRODUCTION_PARITY_CASES } from '@/lib/delivery-parity-inventory.server'
import { loadReleaseParityDescriptor } from '@/lib/release-parity-descriptor.server'

type Fingerprint = Readonly<{ plane: 'analysis' | 'detail'; hash: string }>
function fingerprinting(database: PublicationDatabase, plane: 'analysis' | 'detail', members: Readonly<Record<string, string>>, output: Fingerprint[]): PublicationDatabase {
  return {
    ...database,
    query: async <Row extends Record<string, unknown>>(text: string, params: readonly unknown[]) => {
      let normalized = text
      for (const [member, physical] of Object.entries(members)) normalized = normalized.replaceAll(physical, `@${member}`)
      output.push({ plane, hash: createHash('sha256').update(JSON.stringify([normalized, params])).digest('hex') })
      return database.query<Row>(text, params)
    },
  }
}

const enabled = process.env.UNITBENCH_RELEASE_PARITY === '1'
const run = enabled ? it : it.skip

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Release parity requires ${name}`)
  return value
}
function assertSuccessfulAndNonEmpty(value: unknown, id: string): void {
  if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) throw new Error(`${id} returned no fixture-tied rows`)
  if (typeof value === 'object' && value !== null && 'status' in value) {
    const status = (value as { status: unknown }).status
    if (status !== 'ok') throw new Error(`${id} did not reach its successful view-model boundary: ${String(status)}`)
    const rows = (value as { rows?: unknown[] }).rows
    if (rows && rows.length === 0) throw new Error(`${id} returned an empty successful result`)
  }
}

describe('release parity against the Whetstone pinned fixture', () => {
  run('validates, resolves, and reads both local/remote planes without mutating producer pins', async () => {
    const descriptorPath = requireEnv('WHETSTONE_RELEASE_PARITY_DESCRIPTOR')
    // This parse is intentionally before adapter construction or any query.
    const descriptor = await loadReleaseParityDescriptor(descriptorPath)
    const localAnalysis = resolveOnlyLocalAdapter(resolve(dirname(descriptorPath), descriptor.analysis.local.path))
    const localDetail = resolveOnlyLocalAdapter(resolve(dirname(descriptorPath), descriptor.detail.local.path))
    const remoteAnalysis = resolveOnlyRemoteAdapter('analysis', requireEnv('ANALYSIS_DATABASE_URL'))
    const remoteDetail = resolveOnlyRemoteAdapter('detail', requireEnv('DATABASE_URL'))
    try {
      const [localAnalysisBundle, localDetailBundle, remoteAnalysisBundle, remoteDetailBundle] = await Promise.all([
        resolveOnlyLocalBundle('analysis', localAnalysis, { bundle_key: descriptor.analysis.local.bundle, pin: descriptor.analysis.local.pin, snapshot_seq: descriptor.analysis.local.snapshot_seq, members: descriptor.analysis.local.members }),
        resolveOnlyLocalBundle('detail', localDetail, { bundle_key: descriptor.detail.local.bundle, pin: descriptor.detail.local.pin, snapshot_seq: descriptor.detail.local.snapshot_seq, members: descriptor.detail.local.members }),
        resolveOnlyPinnedBundle('analysis', remoteAnalysis, descriptor.analysis.remote),
        resolveOnlyPinnedBundle('detail', remoteDetail, descriptor.detail.remote),
      ])
      const localFingerprints: Fingerprint[] = []
      const remoteFingerprints: Fingerprint[] = []
      const local = { analysis: { database: fingerprinting(localAnalysis, 'analysis', localAnalysisBundle.members, localFingerprints), bundle: localAnalysisBundle }, detail: { database: fingerprinting(localDetail, 'detail', localDetailBundle.members, localFingerprints), bundle: localDetailBundle } }
      const remote = { analysis: { database: fingerprinting(remoteAnalysis, 'analysis', remoteAnalysisBundle.members, remoteFingerprints), bundle: remoteAnalysisBundle }, detail: { database: fingerprinting(remoteDetail, 'detail', remoteDetailBundle.members, remoteFingerprints), bundle: remoteDetailBundle } }
      for (const item of FROZEN_PRODUCTION_PARITY_CASES) {
        const left = await withResolvedParityBundles(local, () => executeFrozenParityCase(item, descriptor.fixture_prediction_id))
        const right = await withResolvedParityBundles(remote, () => executeFrozenParityCase(item, descriptor.fixture_prediction_id))
        assertSuccessfulAndNonEmpty(left, item.id)
        assertSuccessfulAndNonEmpty(right, item.id)
        if (item.id === 'detail/read') {
          expect((left as { detail?: { prediction_id?: string } }).detail?.prediction_id).toBe(descriptor.fixture_prediction_id)
          expect((right as { detail?: { prediction_id?: string } }).detail?.prediction_id).toBe(descriptor.fixture_prediction_id)
        }
        expect(right, `view model parity: ${item.id}`).toEqual(left)
      }
      expect(remoteFingerprints, 'every normalized SQL/parameter fingerprint').toEqual(localFingerprints)
    } finally {
      await Promise.all([localAnalysis.close?.(), localDetail.close?.(), remoteAnalysis.close?.(), remoteDetail.close?.()])
    }
  }, 120_000)
})
