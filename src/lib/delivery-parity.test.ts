import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { configuredAnalysisAdapter, type AnalysisAdapter } from '@/lib/analysis-adapter.server'
import type { PublicationDatabase } from '@/lib/bundle-pins.server'
import { getAggregatePage, getHeatmapPage } from '@/lib/aggregate-data'
import { fetchCompressionDistribution, fetchCorrectnessCompressionPoints, fetchDashboardRead } from '@/lib/read-layer'
import { getPredictionDetail } from '@/lib/prediction-detail'
import { parseReleaseParityDescriptor, type ParityPlaneEvidence, type ReleaseParityDescriptor } from '@/lib/release-parity-descriptor.server'
import { getTableConfigs } from '@/lib/table-config'
import { getTablePage } from '@/lib/table-data'

type Plane = 'analysis' | 'detail'
type Members = Record<string, string>
type RecordedQuery = Readonly<{ inventoryId: string; plane: Plane; text: string; params: readonly unknown[] }>

const MEMBER_KEYS = [
  'experiments', 'predictions', 'generation_runs', 'score_attempts', 'sweep_metrics', 'failure_metrics',
  'detail_predictions', 'detail_prediction_payloads', 'detail_generation_runs', 'detail_node_attempts',
  'detail_score_attempts', 'detail_score_harness_failures', 'detail_platform_attempts',
] as const
const DEFAULT_MEMBERS = Object.fromEntries(MEMBER_KEYS.map(member => [member, `"${member}"`])) as Members
let recorded: RecordedQuery[] = []
let viewModels: Readonly<{ inventoryId: string; value: unknown }>[] = []
let currentInventoryId = 'unlabelled'
let currentBundles: Record<Plane, ParityPlaneEvidence> = {
  analysis: { destinationId: 'hermetic-analysis', bundleId: 'hermetic', snapshotSeq: 1, pinId: 'hermetic-analysis-pin', members: DEFAULT_MEMBERS, memberCounts: Object.fromEntries(MEMBER_KEYS.map(key => [key, 1])) },
  detail: { destinationId: 'hermetic-detail', bundleId: 'hermetic', snapshotSeq: 1, pinId: 'hermetic-detail-pin', members: DEFAULT_MEMBERS, memberCounts: Object.fromEntries(MEMBER_KEYS.map(key => [key, 1])) },
}
let currentDatabase: PublicationDatabase = {
  query: async (text, params) => { recorded.push({ inventoryId: currentInventoryId, plane: 'analysis', text, params }); return [] },
  transaction: async operation => operation(currentDatabase),
}
let currentDetailDatabase: PublicationDatabase = currentDatabase

vi.mock('@/lib/bundle-adapter.server', () => ({
  withAnalysisBundle: async (operation: (database: PublicationDatabase, bundle: unknown) => unknown) =>
    operation(currentDatabase, { bundleId: currentBundles.analysis.bundleId, snapshotSeq: currentBundles.analysis.snapshotSeq, members: currentBundles.analysis.members }),
  withDetailBundle: async (operation: (database: PublicationDatabase, bundle: unknown) => unknown) =>
    operation(currentDetailDatabase, { bundleId: currentBundles.detail.bundleId, snapshotSeq: currentBundles.detail.snapshotSeq, members: currentBundles.detail.members }),
}))

function record(plane: Plane, database: PublicationDatabase): PublicationDatabase {
  return { ...database, query: async (text, params) => {
    recorded.push({ inventoryId: currentInventoryId, plane, text, params })
    return database.query(text, params)
  } }
}

async function invoke(id: string, fn: () => Promise<unknown>): Promise<void> {
  currentInventoryId = id
  viewModels = [...viewModels, { inventoryId: id, value: await fn() }]
}

/** Every public loader branch is named here. Add a name before adding a query branch. */
const REQUIRED_INVENTORY_IDS = [
  'dashboard:combined', 'dashboard:distribution', 'dashboard:points',
  'table:experiments:default', 'table:experiments:text', 'table:experiments:facet', 'table:experiments:range', 'table:experiments:sort',
  'table:predictions:default', 'table:predictions:text', 'table:predictions:facet', 'table:predictions:range', 'table:predictions:sort',
  'table:detail-predictions:default', 'table:detail-predictions:text', 'table:detail-predictions:facet', 'table:detail-predictions:range', 'table:detail-predictions:sort',
  'aggregate:single-filtered', 'aggregate:clustered-filtered', 'heatmap:filtered', 'detail:present', 'detail:missing',
] as const

async function productionReads(): Promise<void> {
  recorded = []
  viewModels = []
  await invoke('dashboard:combined', () => fetchDashboardRead())
  await invoke('dashboard:distribution', () => fetchCompressionDistribution())
  await invoke('dashboard:points', () => fetchCorrectnessCompressionPoints())
  for (const config of getTableConfigs()) {
    await invoke(`table:${config.id}:default`, () => getTablePage(config.id, { hideTestExperiments: 'false' }))
    const text = config.columns.find(column => column.filter === 'text')?.key
    if (text) await invoke(`table:${config.id}:text`, () => getTablePage(config.id, { [text]: 'fixture', hideTestExperiments: 'true' }))
    const facet = config.columns.find(column => column.filter === 'facet')?.key
    if (facet) await invoke(`table:${config.id}:facet`, () => getTablePage(config.id, { [`${facet}_in`]: 'fixture', [`${facet}_out`]: 'other', hideTestExperiments: 'true' }))
    const range = config.columns.find(column => column.filter === 'range')?.key
    if (range) await invoke(`table:${config.id}:range`, () => getTablePage(config.id, { [`${range}_min`]: '0', [`${range}_max`]: '1', hideTestExperiments: 'true' }))
    const sort = config.columns.find(column => column.sortable)?.key
    if (sort) await invoke(`table:${config.id}:sort`, () => getTablePage(config.id, { sort, dir: 'asc', page: '2', pageSize: '10', hideTestExperiments: 'true' }))
  }
  await invoke('aggregate:single-filtered', () => getAggregatePage({ groupBy: ['model'], sort: 'avg_score', dir: 'asc', page: 2, pageSize: 10, filterIn: { model: ['fixture'] }, filterOut: { experiment_kind: ['other'] }, hideTestExperiments: true }))
  await invoke('aggregate:clustered-filtered', () => getAggregatePage({ groupBy: ['model', 'experiment_kind'], sort: 'n', dir: 'desc', page: 1, pageSize: 25, filterIn: { experiment_kind: ['humaneval_encdec'] }, filterOut: { model: ['other'] }, hideTestExperiments: true }))
  await invoke('heatmap:filtered', () => getHeatmapPage({ x: 'model', y: 'experiment_kind', color: 'pass_rate', filterIn: { model: ['fixture'] }, filterOut: { experiment_kind: ['other'] }, hideTestExperiments: true }))
  await invoke('detail:present', () => getPredictionDetail('fixture/prediction'))
  await invoke('detail:missing', () => getPredictionDetail('fixture/missing'))
}

function fingerprint(query: RecordedQuery, members: Members): string {
  let text = query.text
  for (const key of MEMBER_KEYS) text = text.replaceAll(members[key], `"${key}"`)
  return createHash('sha256').update(JSON.stringify([query.inventoryId, query.plane, text, query.params])).digest('hex')
}

function requireCompleteInventory(queries: readonly RecordedQuery[], members: Record<Plane, Members>, evidence?: readonly Readonly<{ id: string; fingerprint: string }>[]): void {
  const ids = new Set(queries.map(query => query.inventoryId))
  for (const id of REQUIRED_INVENTORY_IDS) if (!ids.has(id)) throw new Error(`delivery parity inventory entry is omitted: ${id}`)
  if (!evidence) return
  const actual = queries.map(query => ({ id: query.inventoryId, fingerprint: fingerprint(query, members[query.plane]) })).sort((a, b) => a.id.localeCompare(b.id) || a.fingerprint.localeCompare(b.fingerprint))
  const expected = [...evidence].sort((a, b) => a.id.localeCompare(b.id) || a.fingerprint.localeCompare(b.fingerprint))
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('delivery parity query evidence is incomplete or drifted')
}

async function descriptorFromEnvironment(): Promise<ReleaseParityDescriptor> {
  if (process.env.UNITBENCH_DELIVERY_PARITY !== '1') throw new Error('UNITBENCH_DELIVERY_PARITY=1 is required')
  const path = process.env.UNITBENCH_DELIVERY_PARITY_DESCRIPTOR?.trim()
  if (!path) throw new Error('UNITBENCH_DELIVERY_PARITY_DESCRIPTOR is required')
  return parseReleaseParityDescriptor(JSON.parse(await readFile(path, 'utf8')), MEMBER_KEYS)
}

describe('delivery parity query inventory', () => {
  beforeEach(() => {
    currentDatabase = record('analysis', { query: async () => [], transaction: async operation => operation(currentDatabase) })
    currentDetailDatabase = record('detail', { query: async () => [], transaction: async operation => operation(currentDetailDatabase) })
    currentBundles = { analysis: { ...currentBundles.analysis, members: DEFAULT_MEMBERS }, detail: { ...currentBundles.detail, members: DEFAULT_MEMBERS } }
  })
  it('has an explicit exhaustive loader inventory, including filters, ranges, facets, sorts, aggregates, heatmap, and detail ids', async () => {
    await productionReads()
    expect(() => requireCompleteInventory(recorded, { analysis: DEFAULT_MEMBERS, detail: DEFAULT_MEMBERS })).not.toThrow()
    expect(recorded.some(query => query.plane === 'detail')).toBe(true)
    expect(recorded.some(query => query.text.includes('GROUP BY'))).toBe(true)
  })
  it('rejects an omitted inventory entry', () => expect(() => requireCompleteInventory([], { analysis: DEFAULT_MEMBERS, detail: DEFAULT_MEMBERS })).toThrow('omitted'))
  it('rejects representation drift rather than coercing an unknown field', () => {
    const queries = REQUIRED_INVENTORY_IDS.map(inventoryId => ({ inventoryId, plane: 'analysis' as const, text: 'SELECT value', params: [1] }))
    expect(() => requireCompleteInventory(queries, { analysis: DEFAULT_MEMBERS, detail: DEFAULT_MEMBERS }, queries.map(query => ({ id: query.inventoryId, fingerprint: 'wrong' })))).toThrow('drifted')
  })
  it('rejects missing, mismatched, empty, and uncleared producer evidence', () => {
    expect(() => parseReleaseParityDescriptor(null, MEMBER_KEYS)).toThrow('absent')
    const valid = { version: 1, fixtureHash: 'a'.repeat(12), local: currentBundles, remote: currentBundles, cleanup: { localRemoved: true, remoteMetadataCounts: { state: 0, bundles: 0, pins: 0 }, remotePhysicalMembers: 0 }, queryEvidence: [] }
    expect(() => parseReleaseParityDescriptor({ ...valid, remote: { ...valid.remote, analysis: { ...valid.remote.analysis, bundleId: 'other' } } }, MEMBER_KEYS)).toThrow('mismatch')
    expect(() => parseReleaseParityDescriptor({ ...valid, local: { ...valid.local, analysis: { ...valid.local.analysis, memberCounts: { ...valid.local.analysis.memberCounts, predictions: 0 } } } }, MEMBER_KEYS)).toThrow('empty')
    expect(() => parseReleaseParityDescriptor({ ...valid, cleanup: { ...valid.cleanup, localRemoved: false } }, MEMBER_KEYS)).toThrow('cleanup')
  })
})

describe('credentialed delivery parity release gate', () => {
  it('fails closed when opt-in, credentials, descriptor, query evidence, or cleanup evidence is absent', async () => {
    if (process.env.UNITBENCH_RELEASE_PARITY !== '1') return
    const descriptor = await descriptorFromEnvironment()
    const localPath = process.env.LOCAL_ANALYSIS_DATABASE_PATH?.trim()
    const remoteUrl = process.env.ANALYSIS_DATABASE_URL?.trim()
    if (!localPath || !remoteUrl) throw new Error('local and remote Analysis credentials are required')
    const run = async (
      analysisEnvironment: NodeJS.ProcessEnv,
      detailEnvironment: NodeJS.ProcessEnv,
      side: ReleaseParityDescriptor['local'],
    ) => {
      const analysisAdapter = configuredAnalysisAdapter(analysisEnvironment)
      // Detail has a different remote owner (Neon).  The read-only adapter
      // implementation is shared, but its connection must never reuse the
      // MotherDuck Analysis URL.
      const detailAdapter = configuredAnalysisAdapter(detailEnvironment)
      try {
        currentBundles = { analysis: side.analysis, detail: side.detail }
        currentDatabase = record('analysis', analysisAdapter)
        currentDetailDatabase = record('detail', detailAdapter)
        await productionReads()
        requireCompleteInventory(recorded, { analysis: side.analysis.members, detail: side.detail.members }, descriptor.queryEvidence)
      } finally { await Promise.all([analysisAdapter.close?.(), detailAdapter.close?.()]) }
    }
    const detailUrl = process.env.DATABASE_URL?.trim()
    if (!detailUrl) throw new Error('DATABASE_URL is required for Detail/Neon parity')
    const localEnvironment = { ...process.env, LOCAL_ANALYSIS_DATABASE_PATH: localPath, ANALYSIS_DATABASE_URL: undefined }
    await run(localEnvironment, localEnvironment, descriptor.local)
    const localQueries = recorded.map(query => ({ ...query, text: fingerprint(query, descriptor.local[query.plane].members) }))
    const localViews = JSON.parse(JSON.stringify(viewModels))
    await run(
      { ...process.env, LOCAL_ANALYSIS_DATABASE_PATH: undefined, ANALYSIS_DATABASE_URL: remoteUrl },
      { ...process.env, LOCAL_ANALYSIS_DATABASE_PATH: undefined, ANALYSIS_DATABASE_URL: detailUrl },
      descriptor.remote,
    )
    expect(recorded.map(query => fingerprint(query, descriptor.remote[query.plane].members))).toEqual(localQueries.map(query => query.text))
    // The loaders are the parser boundary: compare every normalized view model,
    // not raw driver rows or a hand-authored expected result.
    expect(JSON.parse(JSON.stringify(viewModels))).toEqual(localViews)
  }, 120_000)
})
