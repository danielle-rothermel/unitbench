import 'server-only'

import { createHash, randomUUID } from 'node:crypto'
import postgres from 'postgres'
import {
  bundleContract,
  type BundleContract,
  type BundleMember,
  type BundlePlane,
  type AnalysisBundleMember,
  type DetailBundleMember,
} from '@/lib/bundle-contract'
import { publicationStoreConfiguration } from '@/lib/store-environment.server'
import { configuredAnalysisAdapter } from '@/lib/analysis-adapter.server'

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/
const PUBLICATION_STATE_TABLE = 'dr_platform_publication_state'
const PUBLICATION_BUNDLES_TABLE = 'dr_platform_publication_state_bundles'
const PUBLICATION_PINS_TABLE = 'dr_platform_publication_state_pins'

type QueryRow = Record<string, unknown>

export type PublicationDatabase = Readonly<{
  query<Row extends QueryRow>(
    statement: string,
    values: readonly unknown[],
  ): Promise<readonly Row[]>
  transaction<T>(
    operation: (database: PublicationDatabase) => Promise<T>,
  ): Promise<T>
  close?(): Promise<void>
}>

export type BundlePin = Readonly<{
  destinationId: string
  bundleKey: string
  pinId: string
  bundleId: string
  expiresAtMs: number
}>

export type PinnedBundle<Member extends BundleMember = BundleMember> = Readonly<{
  bundleId: string
  snapshotSeq: number
  members: Readonly<Record<Member, string>>
}>

type ManifestMember = Readonly<{
  member: string
  schema_name: string
  table_name: string
  key_columns: readonly string[]
  row_count: number
  checksum: string
}>

type BundleManifest = Readonly<{
  members: readonly ManifestMember[]
  source_families: readonly string[]
}>

type PublishedBundleRow = QueryRow & {
  bundle_id: string
  snapshot_seq: number | string
  manifest_json: string
}

export class BundlePinError extends Error {
  readonly code:
    | 'BUNDLE_NOT_PUBLISHED'
    | 'PIN_EXPIRED_OR_GONE'
    | 'BUNDLE_MANIFEST_INVALID'
    | 'BUNDLE_INTEGRITY_FAILED'

  constructor(code: BundlePinError['code']) {
    super(code)
    this.name = 'BundlePinError'
    this.code = code
  }
}

function quoteIdentifier(identifier: string): string {
  if (!IDENTIFIER.test(identifier)) {
    throw new BundlePinError('BUNDLE_MANIFEST_INVALID')
  }
  return `"${identifier}"`
}

function physicalTable(member: ManifestMember): string {
  return `${quoteIdentifier(member.schema_name)}.${quoteIdentifier(member.table_name)}`
}

/**
 * Mirrors dr-platform's `_canonical`: compact JSON, sorted object keys, and
 * ISO temporal values.  postgres.js returns int8/numeric as strings while
 * DuckDB returns numbers; the member column contract tells us which strings
 * are database scalars rather than application text.
 */
const INTEGER_COLUMNS = new Set([
  'snapshot_seq', 'row_count', 'sample_index', 'attempt_index', 'platform_attempt',
  'failure_count',
])
const FLOAT_COLUMNS = new Set([
  'pass_rate', 'score', 'provider_cost', 'latency_ms', 'compression_ratio', 'metric_value',
])
const JSON_COLUMNS = new Set([
  'config_json', 'summary_json', 'metrics_json', 'request_json', 'response_json',
  'validation_json', 'raw_generation', 'provider_config_json', 'output_json',
  'usage_cost_json', 'response_metadata_json', 'failure_json',
  'dataset_snapshot_json', 'extracted_submission_json', 'per_test_results_json',
])
const TEMPORAL_COLUMNS = new Set([
  'created_at', 'updated_at', 'started_at', 'completed_at', 'enqueued_at', 'terminal_at',
])

function canonicalScalar(value: unknown, column?: string): unknown {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string') {
    if (TEMPORAL_COLUMNS.has(column ?? '')) return new Date(value).toISOString()
    if (FLOAT_COLUMNS.has(column ?? '') && value.trim() !== '') return Number(value)
    if (JSON_COLUMNS.has(column ?? '')) {
      try { return JSON.parse(value) } catch { return value }
    }
  }
  return value
}

function canonicalJson(value: unknown, column?: string): string {
  // json.dumps emits Python int values as JSON numbers.  Keep PostgreSQL int8
  // strings textual here so values above JS's safe integer limit stay exact.
  if (INTEGER_COLUMNS.has(column ?? '') && typeof value === 'string' && /^-?\d+$/.test(value)) {
    return value
  }
  if (INTEGER_COLUMNS.has(column ?? '') && typeof value === 'bigint') return value.toString()
  value = canonicalScalar(value, column)
  if (Array.isArray(value)) {
    return `[${value.map(item => canonicalJson(item)).join(',')}]`
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key], key)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export function platformChecksum(rows: readonly QueryRow[]): string {
  return createHash('sha256').update(canonicalJson(rows)).digest('hex')
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function asNonNegativeInteger(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null
}

function parseManifestMember(value: unknown): ManifestMember | null {
  if (value === null || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const member = asNonEmptyString(record.member)
  const schemaName = asNonEmptyString(record.schema_name)
  const tableName = asNonEmptyString(record.table_name)
  const rowCount = asNonNegativeInteger(record.row_count)
  const memberChecksum = asNonEmptyString(record.checksum)
  const keyColumns = Array.isArray(record.key_columns)
    ? record.key_columns.map(asNonEmptyString)
    : []
  if (
    !member ||
    !schemaName ||
    !tableName ||
    rowCount === null ||
    !memberChecksum ||
    keyColumns.length === 0 ||
    keyColumns.some((column) => column === null)
  ) {
    return null
  }
  return {
    member,
    schema_name: schemaName,
    table_name: tableName,
    key_columns: keyColumns as string[],
    row_count: rowCount,
    checksum: memberChecksum,
  }
}

function parseManifest(value: string): BundleManifest {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new BundlePinError('BUNDLE_MANIFEST_INVALID')
  }
  if (parsed === null || typeof parsed !== 'object') {
    throw new BundlePinError('BUNDLE_MANIFEST_INVALID')
  }
  const record = parsed as Record<string, unknown>
  if (!Array.isArray(record.members) || !Array.isArray(record.source_families)) {
    throw new BundlePinError('BUNDLE_MANIFEST_INVALID')
  }
  const members = record.members.map(parseManifestMember)
  if (members.some((member) => member === null)) {
    throw new BundlePinError('BUNDLE_MANIFEST_INVALID')
  }
  return {
    members: members as ManifestMember[],
    source_families: record.source_families.filter(
      (family): family is string => typeof family === 'string',
    ),
  }
}

function manifestMembers(
  contract: BundleContract,
  manifest: BundleManifest,
): Readonly<Record<BundleMember, ManifestMember>> {
  if (manifest.source_families.length !== 1 || manifest.source_families[0] !== 'application') {
    throw new BundlePinError('BUNDLE_MANIFEST_INVALID')
  }
  const members = new Map(manifest.members.map((member) => [member.member, member]))
  if (
    members.size !== contract.members.length ||
    contract.members.some((member) => !members.has(member))
  ) {
    throw new BundlePinError('BUNDLE_MANIFEST_INVALID')
  }
  return Object.fromEntries(
    contract.members.map((member) => [member, members.get(member)!]),
  ) as Readonly<Record<BundleMember, ManifestMember>>
}

async function rowsForMember(
  database: PublicationDatabase,
  member: ManifestMember,
): Promise<readonly QueryRow[]> {
  const ordering = member.key_columns.map(quoteIdentifier).join(', ')
  return database.query(
    `SELECT * FROM ${physicalTable(member)} ORDER BY ${ordering}`,
    [],
  )
}

async function verifyPinnedBundle<Member extends BundleMember>(
  database: PublicationDatabase,
  contract: BundleContract<BundlePlane, Member>,
  row: PublishedBundleRow,
): Promise<PinnedBundle<Member>> {
  const snapshotSeq = asNonNegativeInteger(row.snapshot_seq)
  if (snapshotSeq === null) throw new BundlePinError('BUNDLE_MANIFEST_INVALID')
  const manifest = parseManifest(row.manifest_json)
  const members = manifestMembers(contract, manifest)
  for (const member of contract.members) {
    const publishedMember = members[member]
    const rows = await rowsForMember(database, publishedMember)
    if (
      rows.length !== publishedMember.row_count ||
      platformChecksum(rows) !== publishedMember.checksum
    ) {
      throw new BundlePinError('BUNDLE_INTEGRITY_FAILED')
    }
  }
  return {
    bundleId: row.bundle_id,
    snapshotSeq,
    members: Object.fromEntries(
      contract.members.map((member) => [member, physicalTable(members[member])]),
    ) as Readonly<Record<Member, string>>,
  }
}

function nativePublicationDatabase(url: string): PublicationDatabase {
  const sql = postgres(url, { connect_timeout: 10, idle_timeout: 20, max: 1 })
  const query = async <Row extends QueryRow>(
    statement: string,
    values: readonly unknown[],
  ): Promise<readonly Row[]> =>
    sql.unsafe(statement, values as never[]) as Promise<readonly Row[]>
  const database: PublicationDatabase = {
    query,
    transaction: async (operation) =>
      sql.begin(async (transaction) => {
        const transactionDatabase: PublicationDatabase = {
          query: async <Row extends QueryRow>(
            statement: string,
            values: readonly unknown[],
          ) =>
            transaction.unsafe(statement, values as never[]) as Promise<
              readonly Row[]
            >,
          transaction: async (nested) => nested(database),
        }
        return operation(transactionDatabase)
      }) as Promise<Awaited<ReturnType<typeof operation>>>,
    close: () => sql.end({ timeout: 5 }),
  }
  return database
}

export async function acquireBundlePin(
  database: PublicationDatabase,
  contract: BundleContract,
  destinationId: string,
  ttlSeconds: number = 300,
): Promise<BundlePin> {
  if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new RangeError('ttlSeconds must be a positive integer')
  }
  return database.transaction(async (transaction) => {
    const [state] = await transaction.query<{ bundle_id: string | null }>(
      `SELECT bundle_id FROM ${PUBLICATION_STATE_TABLE} WHERE destination_id = $1 AND bundle_key = $2`,
      [destinationId, contract.bundleKey],
    )
    if (!state?.bundle_id) throw new BundlePinError('BUNDLE_NOT_PUBLISHED')
    const [published] = await transaction.query<{ bundle_id: string }>(
      `SELECT bundle_id FROM ${PUBLICATION_BUNDLES_TABLE} WHERE destination_id = $1 AND bundle_key = $2 AND bundle_id = $3 AND status = 'PROMOTED'`,
      [destinationId, contract.bundleKey, state.bundle_id],
    )
    if (!published) throw new BundlePinError('BUNDLE_NOT_PUBLISHED')
    const pinId = randomUUID()
    const [pin] = await transaction.query<{ expires_at_ms: number | string }>(
      `INSERT INTO ${PUBLICATION_PINS_TABLE} (destination_id, bundle_key, pin_id, bundle_id, expires_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP + ($5::bigint * INTERVAL '1 second')) RETURNING CAST(extract(epoch FROM expires_at) * 1000 AS BIGINT) AS expires_at_ms`,
      [destinationId, contract.bundleKey, pinId, state.bundle_id, ttlSeconds],
    )
    const expiresAtMs = asNonNegativeInteger(pin?.expires_at_ms)
    if (expiresAtMs === null) throw new BundlePinError('BUNDLE_NOT_PUBLISHED')
    return {
      destinationId,
      bundleKey: contract.bundleKey,
      pinId,
      bundleId: state.bundle_id,
      expiresAtMs,
    }
  })
}

export async function resolveBundlePin<Member extends BundleMember>(
  database: PublicationDatabase,
  contract: BundleContract<BundlePlane, Member>,
  pin: BundlePin,
): Promise<PinnedBundle<Member>> {
  if (pin.bundleKey !== contract.bundleKey) {
    throw new BundlePinError('PIN_EXPIRED_OR_GONE')
  }
  const [published] = await database.query<PublishedBundleRow>(
    `SELECT b.bundle_id, b.snapshot_seq, b.manifest_json FROM ${PUBLICATION_PINS_TABLE} p JOIN ${PUBLICATION_BUNDLES_TABLE} b ON b.destination_id = p.destination_id AND b.bundle_key = p.bundle_key AND b.bundle_id = p.bundle_id WHERE p.destination_id = $1 AND p.bundle_key = $2 AND p.pin_id = $3 AND p.bundle_id = $4 AND p.expires_at > CURRENT_TIMESTAMP AND b.status = 'PROMOTED'`,
    [pin.destinationId, pin.bundleKey, pin.pinId, pin.bundleId],
  )
  if (!published) throw new BundlePinError('PIN_EXPIRED_OR_GONE')
  return verifyPinnedBundle(database, contract, published)
}

export async function withConfiguredPinnedBundle<
  Plane extends BundlePlane,
  Result,
>(
  plane: Plane,
  operation: (
    database: PublicationDatabase,
    bundle: PinnedBundle<
      Plane extends 'analysis' ? AnalysisBundleMember : DetailBundleMember
    >,
  ) => Promise<Result>,
): Promise<Result> {
  const configuration = publicationStoreConfiguration(plane)
  const database = plane === 'analysis'
    ? configuredAnalysisAdapter()
    : nativePublicationDatabase(configuration.databaseUrl)
  const contract = bundleContract(plane)
  try {
    const pin = await acquireBundlePin(database, contract, configuration.destinationId)
    const bundle = await resolveBundlePin(database, contract, pin)
    return await operation(database, bundle as Parameters<typeof operation>[1])
  } finally {
    await database.close?.()
  }
}

export async function pinConfiguredBundle(
  plane: BundlePlane,
): Promise<PinnedBundle> {
  return withConfiguredPinnedBundle(plane, async (_database, bundle) => bundle)
}
