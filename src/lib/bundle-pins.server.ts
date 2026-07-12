import 'server-only'

import { createHash, createPublicKey, randomUUID, verify as verifySignature } from 'node:crypto'
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
import { configuredAnalysisAdapter, localDuckDbAdapter, postgresPublicationAdapter } from '@/lib/analysis-adapter.server'

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/
const PUBLICATION_STATE_TABLE = 'dr_platform_publication_state'
const PUBLICATION_BUNDLES_TABLE = 'dr_platform_publication_state_bundles'
const PUBLICATION_PINS_TABLE = 'dr_platform_publication_state_pins'
const LOCAL_PUBLICATION_STATE_TABLE = '__dr_platform_export_state'
const LOCAL_PUBLICATION_BUNDLES_TABLE = '__dr_platform_export_bundles'
const LOCAL_PUBLICATION_PINS_TABLE = '__dr_platform_export_pins'

type QueryRow = Record<string, unknown>

export type PublicationDatabase = Readonly<{
  kind?: 'duckdb' | 'postgres'
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
  column_schema?: readonly Readonly<{ name: string, type: string }>[]
  columns?: readonly string[]
  physical_digest?: string
}>

type BundleManifest = Readonly<{
  members: readonly ManifestMember[]
  source_families: readonly string[]
}>

type PublishedBundleRow = QueryRow & {
  bundle_id: string
  snapshot_seq: number | string
  manifest_json: string
  integrity_version: string | null
  integrity_key_id: string | null
  integrity_payload_json: string | null
  integrity_signature: string | null
  physical_digest_algorithm: string | null
  source_coordinates_json?: string
}

export class BundlePinError extends Error {
  readonly code:
    | 'BUNDLE_NOT_PUBLISHED'
    | 'PIN_EXPIRED_OR_GONE'
    | 'BUNDLE_MANIFEST_INVALID'
    | 'PINNED_BUNDLE_GONE'

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

type DescriptorMemberIdentity = Readonly<{
  schemaName?: string
  tableName: string
}>

/**
 * Platform descriptors carry reader-facing identifiers, not SQL fragments:
 * remote members are `schema.table`, while local members are `table`.
 * Parse that wire contract before rendering (or comparing) any SQL.
 */
function parseDescriptorMemberIdentity(value: unknown, local: boolean): DescriptorMemberIdentity {
  if (typeof value !== 'string' || value.length === 0) {
    throw new BundlePinError('PINNED_BUNDLE_GONE')
  }
  const parts = value.split('.')
  if ((local && parts.length !== 1) || (!local && parts.length !== 2)) {
    throw new BundlePinError('PINNED_BUNDLE_GONE')
  }
  if (parts.some(part => !IDENTIFIER.test(part))) {
    throw new BundlePinError('PINNED_BUNDLE_GONE')
  }
  return local ? { tableName: parts[0]! } : { schemaName: parts[0]!, tableName: parts[1]! }
}

function matchesDescriptorMember(
  evidence: unknown,
  member: IntegrityMember,
  local: boolean,
): boolean {
  try {
    const descriptor = parseDescriptorMemberIdentity(evidence, local)
    return descriptor.tableName === member.table_name
      && (local || descriptor.schemaName === member.schema_name)
  } catch {
    return false
  }
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
    if (TEMPORAL_COLUMNS.has(column ?? '')) return value
    if (FLOAT_COLUMNS.has(column ?? '') && value.trim() !== '') return Number(value)
    if (JSON_COLUMNS.has(column ?? '')) {
      try { return JSON.parse(value) } catch { return value }
    }
  }
  return value
}

export function platformNumericJson(value: unknown): string {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) throw new BundlePinError('PINNED_BUNDLE_GONE')
  // Platform normalizes all numeric projections to Python float before
  // json.dumps. Start from Number.toString's shortest round-tripping decimal,
  // then apply Python's spelling thresholds and exponent presentation.
  if (Object.is(numeric, -0)) return '-0.0'
  const sign = numeric < 0 ? '-' : ''
  const source = Math.abs(numeric).toString()
  const [coefficient, exponentText] = source.split('e') as [string, string | undefined]
  const decimalIndex = coefficient.indexOf('.')
  const rawDigits = coefficient.replace('.', '')
  const firstSignificant = rawDigits.search(/[1-9]/)
  if (firstSignificant < 0) return '0.0'
  const decimalPosition = decimalIndex < 0 ? coefficient.length : decimalIndex
  const exponent = Number(exponentText ?? '0') + decimalPosition - firstSignificant - 1
  const digits = rawDigits.slice(firstSignificant).replace(/0+$/, '')
  const fixed = () => {
    const position = exponent + 1
    if (position <= 0) return `0.${'0'.repeat(-position)}${digits}`
    if (position >= digits.length) return `${digits}${'0'.repeat(position - digits.length)}`
    return `${digits.slice(0, position)}.${digits.slice(position)}`
  }
  if (exponent >= -4 && exponent < 16) {
    const rendered = fixed()
    return `${sign}${rendered.includes('.') ? rendered : `${rendered}.0`}`
  }
  const mantissa = `${digits[0]}${digits.length > 1 ? `.${digits.slice(1)}` : ''}`
  return `${sign}${mantissa}e${exponent >= 0 ? '+' : '-'}${String(Math.abs(exponent)).padStart(2, '0')}`
}

function canonicalJson(value: unknown, column?: string, jsonNumber = false): string {
  // json.dumps emits Python int values as JSON numbers.  Keep PostgreSQL int8
  // strings textual here so values above JS's safe integer limit stay exact.
  if (INTEGER_COLUMNS.has(column ?? '') && typeof value === 'string' && /^-?\d+$/.test(value)) {
    return value
  }
  if (INTEGER_COLUMNS.has(column ?? '') && typeof value === 'bigint') return value.toString()
  if (FLOAT_COLUMNS.has(column ?? '') && (typeof value === 'string' || typeof value === 'number')) {
    return platformNumericJson(value)
  }
  value = canonicalScalar(value, column)
  // JSON has a distinct integer type in Platform's Python decoder. DuckDB
  // renders JSONB 1.234e16 as an integer token, so preserve that source type;
  // fractional JSON numbers still need Python's float spelling.
  if (jsonNumber && typeof value === 'number' && !Number.isInteger(value)) {
    return platformNumericJson(value)
  }
  const nestedJsonNumber = jsonNumber || JSON_COLUMNS.has(column ?? '')
  if (Array.isArray(value)) {
    return `[${value.map(item => canonicalJson(item, undefined, nestedJsonNumber)).join(',')}]`
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key], key, nestedJsonNumber)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

/** RFC8785-equivalent canonicalization for the deliberately JSON-only payload. */
export function integrityCanonicalJson(value: unknown): string {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new BundlePinError('PINNED_BUNDLE_GONE')
    return String(value)
  }
  if (typeof value === 'string' || value === null || typeof value === 'boolean') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(integrityCanonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${integrityCanonicalJson(record[key])}`).join(',')}}`
  }
  throw new BundlePinError('PINNED_BUNDLE_GONE')
}

type IntegrityMember = ManifestMember & Readonly<{ physical_digest: string }>
const pinnedBundleMemberIdentities = new WeakMap<object, Readonly<Record<string, IntegrityMember>>>()
type SignedIntegrityPayload = Readonly<{
  destination_id: string
  bundle_key: string
  bundle_id: string
  snapshot_seq: number
  integrity_version: 'dr-platform.bundle-integrity.v1'
  source_coordinates_sha256: string
  physical_digest_algorithm: string
  members: readonly IntegrityMember[]
}>

function configuredPublicKeys(environment: NodeJS.ProcessEnv = process.env): Readonly<Record<string, string>> {
  const encoded = environment.UNITBENCH_BUNDLE_INTEGRITY_PUBLIC_KEYS
  if (!encoded) throw new BundlePinError('PINNED_BUNDLE_GONE')
  try {
    const parsed: unknown = JSON.parse(encoded)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not a key ring')
    const keys: [string, string][] = Object.entries(parsed as Record<string, unknown>).flatMap(
      ([key, value]) => IDENTIFIER.test(key) && typeof value === 'string' && value.length > 0
        ? [[key, value]]
        : [],
    )
    if (keys.length === 0) throw new Error('empty key ring')
    return Object.fromEntries(keys)
  } catch {
    throw new BundlePinError('PINNED_BUNDLE_GONE')
  }
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
    column_schema: Array.isArray(record.column_schema)
      ? record.column_schema.flatMap(column => {
        if (column === null || typeof column !== 'object') return []
        const name = asNonEmptyString((column as Record<string, unknown>).name)
        const type = asNonEmptyString((column as Record<string, unknown>).type)
        return name && type ? [{ name, type }] : []
      })
      : undefined,
    columns: Array.isArray(record.columns)
      ? record.columns.flatMap(value => {
        const column = asNonEmptyString(value)
        return column ? [column] : []
      })
      : undefined,
    physical_digest: asNonEmptyString(record.physical_digest) ?? undefined,
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

function authenticatedSourceFamilies(sourceCoordinatesJson: string, expectedDigest: unknown): readonly string[] {
  let coordinates: unknown
  try {
    coordinates = JSON.parse(sourceCoordinatesJson)
  } catch {
    throw new BundlePinError('PINNED_BUNDLE_GONE')
  }
  if (!Array.isArray(coordinates) || typeof expectedDigest !== 'string') {
    throw new BundlePinError('PINNED_BUNDLE_GONE')
  }
  if (createHash('sha256').update(integrityCanonicalJson(coordinates)).digest('hex') !== expectedDigest) {
    throw new BundlePinError('PINNED_BUNDLE_GONE')
  }
  const families = coordinates.map(coordinate => {
    if (coordinate === null || typeof coordinate !== 'object' || Array.isArray(coordinate)) {
      throw new BundlePinError('PINNED_BUNDLE_GONE')
    }
    const sourceId = asNonEmptyString((coordinate as Record<string, unknown>).source_id)
    const [family, identity] = sourceId?.split(':', 2) ?? []
    if ((family !== 'application' && family !== 'dbos') || !identity) {
      throw new BundlePinError('PINNED_BUNDLE_GONE')
    }
    return family
  })
  if (new Set(families).size !== families.length) throw new BundlePinError('PINNED_BUNDLE_GONE')
  return families
}

function signedPayload<Member extends BundleMember>(
  contract: BundleContract<BundlePlane, Member>,
  row: PublishedBundleRow,
  pin: BundlePin,
  snapshotSeq: number,
): SignedIntegrityPayload {
  let value: unknown
  try {
    value = JSON.parse(row.integrity_payload_json ?? '')
  } catch {
    throw new BundlePinError('PINNED_BUNDLE_GONE')
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new BundlePinError('PINNED_BUNDLE_GONE')
  }
  const payload = value as Record<string, unknown>
  const members = payload.members
  if (
    row.integrity_version !== 'dr-platform.bundle-integrity.v1'
    || payload.integrity_version !== 'dr-platform.bundle-integrity.v1'
    || payload.destination_id !== pin.destinationId
    || payload.bundle_key !== pin.bundleKey
    || payload.bundle_id !== pin.bundleId
    || asNonNegativeInteger(payload.snapshot_seq) !== snapshotSeq
    || payload.physical_digest_algorithm !== row.physical_digest_algorithm
    || !Array.isArray(members)
  ) {
    throw new BundlePinError('PINNED_BUNDLE_GONE')
  }
  const key = row.integrity_key_id ? configuredPublicKeys()[row.integrity_key_id] : undefined
  if (!key || !row.integrity_signature) throw new BundlePinError('PINNED_BUNDLE_GONE')
  try {
    const publicKey = createPublicKey({ key: Buffer.from(key, 'base64'), format: 'der', type: 'spki' })
    const message = Buffer.from(`dr-platform.bundle-integrity.v1\0${integrityCanonicalJson(payload)}`, 'utf8')
    if (!verifySignature(null, message, publicKey, Buffer.from(row.integrity_signature, 'base64'))) {
      throw new Error('signature mismatch')
    }
  } catch {
    throw new BundlePinError('PINNED_BUNDLE_GONE')
  }
  const attested = new Map(members.map(member => {
    const parsed = parseManifestMember(member)
    return [parsed?.member ?? '', parsed && parsed.physical_digest ? parsed as IntegrityMember : null]
  }))
  if (attested.size !== contract.members.length) throw new BundlePinError('PINNED_BUNDLE_GONE')
  for (const name of contract.members) {
    const proof = attested.get(name)
    if (
      !proof || proof.member !== name || !proof.physical_digest
      || !IDENTIFIER.test(proof.schema_name) || !IDENTIFIER.test(proof.table_name)
      || !Array.isArray(proof.key_columns) || proof.key_columns.some(key => !IDENTIFIER.test(key))
    ) {
      throw new BundlePinError('PINNED_BUNDLE_GONE')
    }
  }
  return payload as SignedIntegrityPayload
}

async function verifyPhysicalMember(
  database: PublicationDatabase,
  member: IntegrityMember,
  algorithm: string,
): Promise<void> {
  const ordering = member.key_columns.map(quoteIdentifier).join(', ')
  const table = physicalTable(member)
  // Exactly one aggregate result per member; member rows never leave the database.
  try {
    // `verifyPinnedBundle` selects this exact SQL implementation from the
    // signed algorithm identifier before this query is allowed to run.
    const aggregate = algorithm === 'duckdb-json-length-framed-sha256-v1'
      ? `sha256(COALESCE(string_agg(length(to_json(t)::VARCHAR)::VARCHAR || ':' || to_json(t)::VARCHAR, '' ORDER BY ${ordering}), ''))`
      : algorithm === 'postgres-pgcrypto-row-json-length-framed-sha256-v1'
        ? `encode(digest(COALESCE(string_agg(length(row_to_json(t)::text)::text || ':' || row_to_json(t)::text, '' ORDER BY ${ordering}), ''), 'sha256'), 'hex')`
        : (() => { throw new BundlePinError('PINNED_BUNDLE_GONE') })()
    const [result] = await database.query<{ row_count: number | string, physical_digest: string | null }>(
      `SELECT COUNT(*) AS row_count, ${aggregate} AS physical_digest FROM ${table} t`, [],
    )
    if (asNonNegativeInteger(result?.row_count) !== member.row_count || result?.physical_digest !== member.physical_digest) {
      throw new BundlePinError('PINNED_BUNDLE_GONE')
    }
  } catch (error) {
    if (error instanceof BundlePinError) throw error
    throw new BundlePinError('PINNED_BUNDLE_GONE')
  }
}

async function verifyPinnedBundle<Member extends BundleMember>(
  database: PublicationDatabase,
  contract: BundleContract<BundlePlane, Member>,
  row: PublishedBundleRow,
  pin: BundlePin,
): Promise<PinnedBundle<Member>> {
  const snapshotSeq = asNonNegativeInteger(row.snapshot_seq)
  if (snapshotSeq === null) throw new BundlePinError('BUNDLE_MANIFEST_INVALID')
  const parsedManifest = parseManifest(row.manifest_json)
  if (
    parsedManifest.members.length !== contract.members.length
    || new Set(parsedManifest.members.map(member => member.member)).size !== contract.members.length
    || contract.members.some(member => !parsedManifest.members.some(candidate => candidate.member === member))
  ) {
    manifestMembers(contract, parsedManifest)
  }
  const payload = signedPayload(contract, row, pin, snapshotSeq)
  const families = authenticatedSourceFamilies(row.source_coordinates_json ?? '', payload.source_coordinates_sha256)
  if (
    parsedManifest.source_families.length !== families.length
    || [...parsedManifest.source_families].sort().some((family, index) => family !== [...families].sort()[index])
  ) {
    throw new BundlePinError('PINNED_BUNDLE_GONE')
  }
  const manifest = manifestMembers(contract, parsedManifest)
  if (!['duckdb-json-length-framed-sha256-v1', 'postgres-pgcrypto-row-json-length-framed-sha256-v1'].includes(payload.physical_digest_algorithm)) {
    throw new BundlePinError('PINNED_BUNDLE_GONE')
  }
  const members = Object.fromEntries(payload.members.map(member => [member.member, member])) as Readonly<Record<Member, IntegrityMember>>
  for (const member of contract.members) {
    const signed = members[member]
    const published = manifest[member]
    if (
      signed.schema_name !== published.schema_name
      || signed.table_name !== published.table_name
      || signed.row_count !== published.row_count
      || signed.checksum !== published.checksum
      || signed.key_columns.length !== published.key_columns.length
      || signed.key_columns.some((key, index) => key !== published.key_columns[index])
    ) {
      throw new BundlePinError('PINNED_BUNDLE_GONE')
    }
    await verifyPhysicalMember(database, signed, payload.physical_digest_algorithm)
  }
  const resolved = {
    bundleId: row.bundle_id,
    snapshotSeq,
    members: Object.fromEntries(
      contract.members.map((member) => [member, physicalTable(members[member])]),
    ) as Readonly<Record<Member, string>>,
  }
  pinnedBundleMemberIdentities.set(resolved, members)
  return resolved
}

function nativePublicationDatabase(url: string): PublicationDatabase {
  const sql = postgres(url, { connect_timeout: 10, idle_timeout: 20, max: 1 })
  const query = async <Row extends QueryRow>(
    statement: string,
    values: readonly unknown[],
  ): Promise<readonly Row[]> =>
    sql.unsafe(statement, values as never[]) as Promise<readonly Row[]>
  const database: PublicationDatabase = {
    kind: 'postgres',
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
          kind: 'postgres',
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
  let published: PublishedBundleRow | undefined
  try { [published] = await database.query<PublishedBundleRow>(
    `SELECT b.bundle_id, b.snapshot_seq, b.source_coordinates_json, b.manifest_json, b.integrity_version, b.integrity_key_id, b.integrity_payload_json, b.integrity_signature, b.physical_digest_algorithm FROM ${PUBLICATION_PINS_TABLE} p JOIN ${PUBLICATION_BUNDLES_TABLE} b ON b.destination_id = p.destination_id AND b.bundle_key = p.bundle_key AND b.bundle_id = p.bundle_id WHERE p.destination_id = $1 AND p.bundle_key = $2 AND p.pin_id = $3 AND p.bundle_id = $4 AND p.expires_at > CURRENT_TIMESTAMP AND b.status = 'PROMOTED'`,
    [pin.destinationId, pin.bundleKey, pin.pinId, pin.bundleId],
  ) } catch { throw new BundlePinError('PINNED_BUNDLE_GONE') }
  if (!published) throw new BundlePinError('PIN_EXPIRED_OR_GONE')
  try { return await verifyPinnedBundle(database, contract, published, pin) }
  catch (error) {
    if (error instanceof BundlePinError) throw error
    throw new BundlePinError('PINNED_BUNDLE_GONE')
  }
}

async function acquireLocalBundlePin(
  database: PublicationDatabase,
  contract: BundleContract,
  destinationId: string,
  ttlSeconds: number,
): Promise<BundlePin> {
  return database.transaction(async transaction => {
    const [state] = await transaction.query<{ bundle_id: string | null }>(
      `SELECT bundle_id FROM ${LOCAL_PUBLICATION_STATE_TABLE} WHERE destination_id = ? AND bundle_key = ?`,
      [destinationId, contract.bundleKey],
    )
    if (!state?.bundle_id) throw new BundlePinError('BUNDLE_NOT_PUBLISHED')
    const [published] = await transaction.query<{ bundle_id: string }>(
      `SELECT bundle_id FROM ${LOCAL_PUBLICATION_BUNDLES_TABLE} WHERE destination_id = ? AND bundle_key = ? AND bundle_id = ?`,
      [destinationId, contract.bundleKey, state.bundle_id],
    )
    if (!published) throw new BundlePinError('BUNDLE_NOT_PUBLISHED')
    const pinId = randomUUID()
    const [pin] = await transaction.query<{ expires_at_ms: number | string }>(
      `INSERT INTO ${LOCAL_PUBLICATION_PINS_TABLE} (destination_id, bundle_key, pin_id, bundle_id, expires_at, created_at) VALUES (?, ?, ?, ?, epoch_ms(now()) + ?, epoch_ms(now())) RETURNING expires_at AS expires_at_ms`,
      [destinationId, contract.bundleKey, pinId, state.bundle_id, ttlSeconds * 1000],
    )
    const expiresAtMs = asNonNegativeInteger(pin?.expires_at_ms)
    if (expiresAtMs === null) throw new BundlePinError('BUNDLE_NOT_PUBLISHED')
    return { destinationId, bundleKey: contract.bundleKey, pinId, bundleId: state.bundle_id, expiresAtMs }
  })
}

export async function releaseBundlePin(
  database: PublicationDatabase,
  pin: BundlePin,
): Promise<void> {
  await database.query(
    `DELETE FROM ${PUBLICATION_PINS_TABLE} WHERE destination_id = $1 AND bundle_key = $2 AND pin_id = $3 AND bundle_id = $4`,
    [pin.destinationId, pin.bundleKey, pin.pinId, pin.bundleId],
  )
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
  let pin: BundlePin | undefined
  try {
    pin = database.kind === 'duckdb'
      ? await acquireLocalBundlePin(database, contract, configuration.destinationId, 300)
      : await acquireBundlePin(database, contract, configuration.destinationId)
    return await database.transaction(async transaction => {
      // This connection and snapshot also serve the page operation below.
      if (transaction.kind === 'postgres') {
        await transaction.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ', [])
      }
      const bundle = database.kind === 'duckdb'
        ? await resolveLocalBundlePin(transaction, contract, pin!)
        : await resolveBundlePin(transaction, contract, pin!)
      return operation(transaction, bundle as Parameters<typeof operation>[1])
    })
  } finally {
    if (pin) await (database.kind === 'duckdb' ? releaseLocalBundlePin(database, pin) : releaseBundlePin(database, pin))
    await database.close?.()
  }
}

async function releaseLocalBundlePin(database: PublicationDatabase, pin: BundlePin): Promise<void> {
  await database.query(
    `DELETE FROM ${LOCAL_PUBLICATION_PINS_TABLE} WHERE destination_id = ? AND bundle_key = ? AND pin_id = ? AND bundle_id = ?`,
    [pin.destinationId, pin.bundleKey, pin.pinId, pin.bundleId],
  )
}

export type ResolveOnlyPin = Readonly<{
  destination_id: string
  bundle_key: string
  pin: Readonly<{ pin_id: string; bundle_id: string; expires_at_ms: number }>
  snapshot_seq: number
  members: Readonly<Record<string, string>>
}>

/**
 * Resolves a producer-created pin. Deliberately does not acquire, renew, or
 * delete a pin: release parity is a read-only consumer of fixture lifecycle.
 */
export async function resolveOnlyPinnedBundle<Plane extends BundlePlane>(
  plane: Plane,
  database: PublicationDatabase,
  evidence: ResolveOnlyPin,
): Promise<PinnedBundle<Plane extends 'analysis' ? AnalysisBundleMember : DetailBundleMember>> {
  const contract = bundleContract(plane)
  if (evidence.bundle_key !== contract.bundleKey) throw new BundlePinError('PIN_EXPIRED_OR_GONE')
  const resolved = await resolveBundlePin(database, contract, {
    destinationId: evidence.destination_id,
    bundleKey: evidence.bundle_key,
    pinId: evidence.pin.pin_id,
    bundleId: evidence.pin.bundle_id,
    expiresAtMs: evidence.pin.expires_at_ms,
  })
  if (resolved.bundleId !== evidence.pin.bundle_id || resolved.snapshotSeq !== evidence.snapshot_seq) {
    throw new BundlePinError('PINNED_BUNDLE_GONE')
  }
  for (const member of contract.members) {
    const signed = pinnedBundleMemberIdentities.get(resolved)?.[member]
    if (!signed || !matchesDescriptorMember(evidence.members[member], signed, false)) {
      throw new BundlePinError('PINNED_BUNDLE_GONE')
    }
  }
  return resolved as PinnedBundle<Plane extends 'analysis' ? AnalysisBundleMember : DetailBundleMember>
}

export function resolveOnlyLocalAdapter(path: string): PublicationDatabase {
  return localDuckDbAdapter(path)
}

export function resolveOnlyRemoteAdapter(plane: BundlePlane, url: string): PublicationDatabase {
  return plane === 'analysis' ? postgresPublicationAdapter(url) : nativePublicationDatabase(url)
}

function localManifestMembers<Member extends BundleMember>(
  contract: BundleContract<BundlePlane, Member>,
  manifestJson: string,
  payload: SignedIntegrityPayload,
): Readonly<Record<Member, IntegrityMember>> {
  let manifest: unknown
  try { manifest = JSON.parse(manifestJson) } catch { throw new BundlePinError('PINNED_BUNDLE_GONE') }
  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) throw new BundlePinError('PINNED_BUNDLE_GONE')
  const signed = new Map(payload.members.map(member => [member.member, member]))
  const resolved = {} as Record<Member, IntegrityMember>
  for (const member of contract.members) {
    const proof = signed.get(member)
    const facts = (manifest as Record<string, unknown>)[member]
    if (!proof || facts === null || typeof facts !== 'object' || Array.isArray(facts)) throw new BundlePinError('PINNED_BUNDLE_GONE')
    const record = facts as Record<string, unknown>
    const columns = proof.column_schema?.length
      ? proof.column_schema
      : proof.columns
    const manifestColumns = Array.isArray(record.column_schema) ? record.column_schema : record.columns
    if (
      record.table !== proof.table_name
      || record.checksum !== proof.checksum
      || !Array.isArray(record.unique_key)
      || record.unique_key.length !== proof.key_columns.length
      || record.unique_key.some((key, index) => key !== proof.key_columns[index])
      || integrityCanonicalJson(manifestColumns) !== integrityCanonicalJson(columns)
    ) throw new BundlePinError('PINNED_BUNDLE_GONE')
    resolved[member] = proof
  }
  return resolved
}

async function verifyLocalLogicalMember(database: PublicationDatabase, member: IntegrityMember): Promise<void> {
  const columnSchema = member.column_schema?.length ? member.column_schema : (member.columns ?? []).map(name => ({ name, type: '' }))
  const columns = columnSchema.map(column => column.name)
  if (!columns?.length) throw new BundlePinError('PINNED_BUNDLE_GONE')
  const table = quoteIdentifier(member.table_name)
  const ordering = member.key_columns.map(quoteIdentifier).join(', ')
  try {
    // Node's DuckDB binding turns TIMESTAMPTZ into millisecond JS Dates. Ask
    // DuckDB for a UTC text scalar instead: Platform parses destination text,
    // normalizes it with ``astimezone(UTC)``, then canonicalizes it.  strftime
    // preserves all six fractional-second digits while matching that wire form.
    const selections = columnSchema.map(column => column.type === 'timestamp'
      ? `strftime(${quoteIdentifier(column.name)} AT TIME ZONE 'UTC', '%Y-%m-%dT%H:%M:%S.%f+00:00') AS ${quoteIdentifier(column.name)}`
      : column.type === 'numeric'
        ? `CAST(${quoteIdentifier(column.name)} AS VARCHAR) AS ${quoteIdentifier(column.name)}`
      : quoteIdentifier(column.name))
    const rows = await database.query<QueryRow>(
      `SELECT ${selections.join(', ')} FROM ${table} ORDER BY ${ordering}`,
      [],
    )
    if (platformChecksum(rows) !== member.checksum) throw new BundlePinError('PINNED_BUNDLE_GONE')
  } catch (error) {
    if (error instanceof BundlePinError) throw error
    throw new BundlePinError('PINNED_BUNDLE_GONE')
  }
}

async function resolveLocalBundlePin<Member extends BundleMember>(
  database: PublicationDatabase,
  contract: BundleContract<BundlePlane, Member>,
  pin: BundlePin,
): Promise<PinnedBundle<Member>> {
  let row: PublishedBundleRow | undefined
  try { [row] = await database.query<PublishedBundleRow>(
    `SELECT b.bundle_id, b.snapshot_seq, b.manifest_json, b.integrity_version, b.integrity_key_id, b.integrity_payload_json, b.integrity_signature, b.physical_digest_algorithm FROM ${LOCAL_PUBLICATION_PINS_TABLE} p JOIN ${LOCAL_PUBLICATION_BUNDLES_TABLE} b ON b.destination_id = p.destination_id AND b.bundle_key = p.bundle_key AND b.bundle_id = p.bundle_id WHERE p.destination_id = ? AND p.bundle_key = ? AND p.pin_id = ? AND p.bundle_id = ? AND p.expires_at > epoch_ms(now())`,
    [pin.destinationId, pin.bundleKey, pin.pinId, pin.bundleId],
  ) } catch { throw new BundlePinError('PINNED_BUNDLE_GONE') }
  if (!row) throw new BundlePinError('PIN_EXPIRED_OR_GONE')
  const snapshotSeq = asNonNegativeInteger(row.snapshot_seq)
  if (snapshotSeq === null) throw new BundlePinError('PINNED_BUNDLE_GONE')
  const payload = signedPayload(contract, row, pin, snapshotSeq)
  if (payload.physical_digest_algorithm !== 'duckdb-json-length-framed-sha256-v1') throw new BundlePinError('PINNED_BUNDLE_GONE')
  const members = localManifestMembers(contract, row.manifest_json, payload)
  for (const member of contract.members) {
    await verifyLocalLogicalMember(database, members[member])
    await verifyPhysicalMember(database, members[member], payload.physical_digest_algorithm)
  }
  const resolved = {
    bundleId: pin.bundleId,
    snapshotSeq,
    members: Object.fromEntries(contract.members.map(member => [member, quoteIdentifier(members[member].table_name)])) as Readonly<Record<Member, string>>,
  }
  pinnedBundleMemberIdentities.set(resolved, members)
  return resolved
}

/** Resolves a producer-created Platform DuckDB pin without changing its lifecycle. */
export async function resolveOnlyLocalBundle<Plane extends BundlePlane>(
  plane: Plane,
  database: PublicationDatabase,
  evidence: Omit<ResolveOnlyPin, 'destination_id'>,
): Promise<PinnedBundle<Plane extends 'analysis' ? AnalysisBundleMember : DetailBundleMember>> {
  const contract = bundleContract(plane)
  if (evidence.bundle_key !== contract.bundleKey) throw new BundlePinError('PIN_EXPIRED_OR_GONE')
  const resolved = await resolveLocalBundlePin(database, contract, {
    destinationId: 'local-duckdb', bundleKey: evidence.bundle_key, pinId: evidence.pin.pin_id,
    bundleId: evidence.pin.bundle_id, expiresAtMs: evidence.pin.expires_at_ms,
  })
  if (resolved.snapshotSeq !== evidence.snapshot_seq) throw new BundlePinError('PINNED_BUNDLE_GONE')
  for (const member of contract.members) {
    const signed = pinnedBundleMemberIdentities.get(resolved)?.[member]
    if (!signed || !matchesDescriptorMember(evidence.members[member], signed, true)) {
      throw new BundlePinError('PINNED_BUNDLE_GONE')
    }
  }
  return {
    ...resolved,
    members: resolved.members as PinnedBundle<Plane extends 'analysis' ? AnalysisBundleMember : DetailBundleMember>['members'],
  }
}

export async function pinConfiguredBundle(
  plane: BundlePlane,
): Promise<PinnedBundle> {
  return withConfiguredPinnedBundle(plane, async (_database, bundle) => bundle)
}
