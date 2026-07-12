import { cp, mkdtemp, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { configuredAnalysisAdapter } from '@/lib/analysis-adapter.server'
import { withResolvedParityBundles } from '@/lib/bundle-adapter.server'
import { resolveOnlyLocalAdapter, resolveOnlyLocalBundle, type PublicationDatabase } from '@/lib/bundle-pins.server'
import { executeFrozenParityCase, FROZEN_PRODUCTION_PARITY_CASES, FROZEN_PRODUCTION_PARITY_INVENTORY } from '@/lib/delivery-parity-inventory.server'
import { loadLocalReleaseParityDescriptor } from '@/lib/local-release-parity-descriptor.server'

const enabled = process.env.UNITBENCH_LOCAL_RELEASE_PARITY === '1'
const run = enabled ? it : it.skip
const required = (name: string): string => {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Local release parity requires ${name}`)
  return value
}
function assertSuccessfulAndNonEmpty(value: unknown, id: string): void {
  if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) throw new Error(`${id} returned no fixture-tied rows`)
  if (typeof value === 'object' && value !== null && 'status' in value) {
    const result = value as { status: unknown; rows?: unknown[]; prediction?: { prediction_id?: unknown } }
    if (result.status !== 'ok') throw new Error(`${id} did not reach its successful view-model boundary: ${String(result.status)}`)
    if (result.rows && result.rows.length === 0) throw new Error(`${id} returned an empty successful result`)
  }
}
function fingerprinting(database: PublicationDatabase, plane: 'analysis' | 'detail', output: string[]): PublicationDatabase {
  return { ...database, query: async <Row extends Record<string, unknown>>(sql: string, params: readonly unknown[]) => {
    output.push(`${plane}:${createHash('sha256').update(JSON.stringify([sql, params])).digest('hex')}`)
    return database.query<Row>(sql, params)
  } }
}

describe('local release parity against a Whetstone-produced signed DuckDB', () => {
  run('resolves exact producer evidence and executes all frozen production loaders fail-closed', async () => {
    const descriptorPath = required('WHETSTONE_LOCAL_RELEASE_PARITY_DESCRIPTOR')
    const descriptor = await loadLocalReleaseParityDescriptor(descriptorPath)
    const analysisPath = resolve(dirname(descriptorPath), descriptor.analysis.path)
    const detailPath = resolve(dirname(descriptorPath), descriptor.detail.path)
    const configured = configuredAnalysisAdapter({ ...process.env, LOCAL_ANALYSIS_DATABASE_PATH: analysisPath })
    expect(configured.kind).toBe('duckdb')
    await configured.close?.()
    const analysis = resolveOnlyLocalAdapter(analysisPath)
    const detail = resolveOnlyLocalAdapter(detailPath)
    try {
      const [analysisBundle, detailBundle] = await Promise.all([
        resolveOnlyLocalBundle('analysis', analysis, { bundle_key: descriptor.analysis.bundle, pin: descriptor.analysis.pin, snapshot_seq: descriptor.analysis.snapshot_seq, members: descriptor.analysis.members }),
        resolveOnlyLocalBundle('detail', detail, { bundle_key: descriptor.detail.bundle, pin: descriptor.detail.pin, snapshot_seq: descriptor.detail.snapshot_seq, members: descriptor.detail.members }),
      ])
      expect(FROZEN_PRODUCTION_PARITY_INVENTORY).toHaveLength(2024)
      const fingerprints: string[] = []
      const resolved = { analysis: { database: fingerprinting(analysis, 'analysis', fingerprints), bundle: analysisBundle }, detail: { database: fingerprinting(detail, 'detail', fingerprints), bundle: detailBundle } }
      const completed: string[] = []
      for (const item of FROZEN_PRODUCTION_PARITY_INVENTORY) {
        const executable = FROZEN_PRODUCTION_PARITY_CASES.find(candidate => candidate.id === item.id)
        if (!executable) throw new Error(`Production parity case is missing: ${item.id}`)
        const value = await withResolvedParityBundles(resolved, () => executeFrozenParityCase(executable, descriptor.fixture_prediction_id))
        assertSuccessfulAndNonEmpty(value, item.id)
        if (item.id === 'detail/read') expect((value as { detail?: { prediction_id?: string } }).detail?.prediction_id).toBe(descriptor.fixture_prediction_id)
        completed.push(item.id)
      }
      expect(completed).toEqual(FROZEN_PRODUCTION_PARITY_INVENTORY.map(item => item.id))
      expect(new Set(fingerprints).size).toBeGreaterThan(2024)
    } finally { await Promise.all([analysis.close?.(), detail.close?.()]) }

    const copyDirectory = await mkdtemp(resolve(tmpdir(), 'unitbench-local-parity-'))
    try {
      const expired = resolve(copyDirectory, 'expired.duckdb')
      await cp(analysisPath, expired)
      const expiredDb = resolveOnlyLocalAdapter(expired)
      await expiredDb.query('UPDATE __dr_platform_export_pins SET expires_at = 0', [])
      await expect(resolveOnlyLocalBundle('analysis', expiredDb, { bundle_key: descriptor.analysis.bundle, pin: descriptor.analysis.pin, snapshot_seq: descriptor.analysis.snapshot_seq, members: descriptor.analysis.members })).rejects.toMatchObject({ code: 'PIN_EXPIRED_OR_GONE' })
      await expiredDb.close?.()

      const tampered = resolve(copyDirectory, 'tampered.duckdb')
      await cp(analysisPath, tampered)
      const tamperedDb = resolveOnlyLocalAdapter(tampered)
      await tamperedDb.query(`UPDATE "${descriptor.analysis.members.predictions}" SET prediction_id = 'tampered'`, [])
      await expect(resolveOnlyLocalBundle('analysis', tamperedDb, { bundle_key: descriptor.analysis.bundle, pin: descriptor.analysis.pin, snapshot_seq: descriptor.analysis.snapshot_seq, members: descriptor.analysis.members })).rejects.toMatchObject({ code: 'PINNED_BUNDLE_GONE' })
      await tamperedDb.close?.()

      const missing = resolve(copyDirectory, 'missing.duckdb')
      await cp(analysisPath, missing)
      const missingDb = resolveOnlyLocalAdapter(missing)
      await missingDb.query(`ALTER TABLE "${descriptor.analysis.members.predictions}" RENAME TO renamed_predictions`, [])
      await expect(resolveOnlyLocalBundle('analysis', missingDb, { bundle_key: descriptor.analysis.bundle, pin: descriptor.analysis.pin, snapshot_seq: descriptor.analysis.snapshot_seq, members: descriptor.analysis.members })).rejects.toMatchObject({ code: 'PINNED_BUNDLE_GONE' })
      await missingDb.close?.()
    } finally { await rm(copyDirectory, { recursive: true, force: true }) }
  }, 120_000)
})
