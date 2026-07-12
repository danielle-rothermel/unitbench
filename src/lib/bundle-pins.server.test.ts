import { createHash, createPrivateKey, sign as signPayload } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { ANALYSIS_BUNDLE_CONTRACT } from '@/lib/bundle-contract'
import {
  acquireBundlePin,
  BundlePinError,
  releaseBundlePin,
  resolveBundlePin,
  integrityCanonicalJson,
  platformChecksum,
  type PublicationDatabase,
} from '@/lib/bundle-pins.server'

const EMPTY_CHECKSUM = createHash('sha256').update('[]').digest('hex')
const PHYSICAL_DIGEST = createHash('sha256').update('').digest('hex')
const KEY_ID = 'test_ed25519'
const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEID4v6djRiugbIu3mOJMBQLqV5QGHI1V2AkVe/hp4OyAR
-----END PRIVATE KEY-----`
const TEST_PUBLIC_KEY = 'MCowBQYDK2VwAyEA0ezQwg8kdwyTQPHwHKuqmndPWfGfc8NuYCFsbma+y/Y='

function manifest(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    source_families: ['application'],
    members: ANALYSIS_BUNDLE_CONTRACT.members.map((member) => ({
      member,
      schema_name: 'public',
      table_name: `bundle_${member}`,
      key_columns: ['bundle_id'],
      row_count: 0,
      checksum: EMPTY_CHECKSUM,
    })),
    ...overrides,
  })
}

function signedPayload(manifestJson: string, overrides: Record<string, unknown> = {}) {
  const parsed = JSON.parse(manifestJson)
  const payload = {
    destination_id: pin.destinationId,
    bundle_key: pin.bundleKey,
    bundle_id: pin.bundleId,
    snapshot_seq: 0,
    integrity_version: 'dr-platform.bundle-integrity.v1',
    source_coordinates_sha256: EMPTY_CHECKSUM,
    physical_digest_algorithm: 'postgres-pgcrypto-row-json-length-framed-sha256-v1',
    members: parsed.members.map((member: Record<string, unknown>) => ({
      ...member,
      physical_digest: PHYSICAL_DIGEST,
    })),
    ...overrides,
  }
  const canonical = integrityCanonicalJson(payload)
  return {
    payload: JSON.stringify(payload),
    signature: signPayload(null, Buffer.from(`dr-platform.bundle-integrity.v1\0${canonical}`), createPrivateKey(TEST_PRIVATE_KEY)).toString('base64'),
  }
}

function databaseFor(
  published: Record<string, unknown> | undefined,
): PublicationDatabase {
  return {
    query: async <Row extends Record<string, unknown>>(
      statement: string,
      values: readonly unknown[],
    ) => {
      void values
      if (statement.includes('dr_platform_publication_state_pins')) {
        if (!published) return [] as Row[]
        const payload = signedPayload(String(published.manifest_json), {
          bundle_id: String(published.bundle_id),
          snapshot_seq: Number(published.snapshot_seq),
        })
        return [{
          integrity_version: 'dr-platform.bundle-integrity.v1',
          integrity_key_id: KEY_ID,
          integrity_payload_json: payload.payload,
          integrity_signature: payload.signature,
          physical_digest_algorithm: 'postgres-pgcrypto-row-json-length-framed-sha256-v1',
          ...published,
        }] as unknown as Row[]
      }
      if (statement.startsWith('SELECT COUNT(*)')) {
        return [{ row_count: 0, physical_digest: PHYSICAL_DIGEST }] as unknown as Row[]
      }
      return [] as Row[]
    },
    transaction: async (operation) => operation(databaseFor(published)),
  }
}

const pin = {
  destinationId: 'motherduck-analysis',
  bundleKey: 'whetstone-analysis',
  pinId: 'pin-1',
  bundleId: 'bundle-1',
  expiresAtMs: 100,
}

process.env.UNITBENCH_BUNDLE_INTEGRITY_PUBLIC_KEYS = JSON.stringify({ [KEY_ID]: TEST_PUBLIC_KEY })

describe('resolveBundlePin', () => {
  it('fails closed when a legacy unsigned promoted row is pinned', async () => {
    await expect(
      resolveBundlePin(
        databaseFor({
          bundle_id: 'bundle-1',
          snapshot_seq: 0,
          manifest_json: manifest(),
          integrity_version: null,
          integrity_key_id: null,
          integrity_payload_json: null,
          integrity_signature: null,
          physical_digest_algorithm: null,
        }),
        ANALYSIS_BUNDLE_CONTRACT,
        pin,
      ),
    ).rejects.toMatchObject({ code: 'PINNED_BUNDLE_GONE' })
  })

  it('uses dr-platform canonical scalar values across postgres.js and DuckDB', () => {
    const postgresRows = [{
      bundle_id: 'bundle-1', snapshot_seq: '42', row_count: '9007199254740991',
      pass_rate: '0.125', summary_json: '{"z":null,"a":[2,1]}',
      created_at: '2026-07-12T12:34:56.000Z', input_text: '001',
      failure_json: null,
    }]
    const duckdbRows = [{
      bundle_id: 'bundle-1', snapshot_seq: 42, row_count: BigInt('9007199254740991'),
      pass_rate: 0.125, summary_json: { a: [2, 1], z: null },
      created_at: new Date('2026-07-12T12:34:56.000Z'), input_text: '001',
      failure_json: null,
    }]
    expect(platformChecksum(postgresRows)).toBe(platformChecksum(duckdbRows))
  })
  it('accepts only a complete, signed and checksummed application bundle', async () => {
    await expect(
      resolveBundlePin(
        databaseFor({
          bundle_id: 'bundle-1',
          snapshot_seq: '0',
          manifest_json: manifest(),
        }),
        ANALYSIS_BUNDLE_CONTRACT,
        pin,
      ),
    ).resolves.toEqual({
      bundleId: 'bundle-1',
      snapshotSeq: 0,
      members: {
        experiments: '"public"."bundle_experiments"',
        predictions: '"public"."bundle_predictions"',
        generation_runs: '"public"."bundle_generation_runs"',
        score_attempts: '"public"."bundle_score_attempts"',
        sweep_metrics: '"public"."bundle_sweep_metrics"',
        failure_metrics: '"public"."bundle_failure_metrics"',
      },
    })
  })

  it('reads only the resolved signed payload, never current state or member tables', async () => {
    const statements: string[] = []
    const database = databaseFor({
      bundle_id: 'bundle-1',
      snapshot_seq: 4,
      manifest_json: manifest(),
    })
    const recordingDatabase: PublicationDatabase = {
      ...database,
      query: async <Row extends Record<string, unknown>>(
        statement: string,
        values: readonly unknown[],
      ) => {
        statements.push(statement)
        return database.query<Row>(statement, values)
      },
    }

    await resolveBundlePin(recordingDatabase, ANALYSIS_BUNDLE_CONTRACT, pin)

    expect(statements.filter(statement => statement.startsWith('SELECT * FROM'))).toEqual([])
    expect(statements.join('\n')).not.toContain('dr_platform_publication_state WHERE')
    expect(statements).toHaveLength(1 + ANALYSIS_BUNDLE_CONTRACT.members.length)
  })

  it('fails closed for an expired or missing pin', async () => {
    await expect(
      resolveBundlePin(databaseFor(undefined), ANALYSIS_BUNDLE_CONTRACT, pin),
    ).rejects.toMatchObject({
      code: 'PIN_EXPIRED_OR_GONE',
    })
  })

  it('rejects incomplete manifests before reading physical members', async () => {
    await expect(
      resolveBundlePin(
        databaseFor({
          bundle_id: 'bundle-1',
          snapshot_seq: 4,
          manifest_json: manifest({ members: [] }),
        }),
        ANALYSIS_BUNDLE_CONTRACT,
        pin,
      ),
    ).rejects.toMatchObject({
      code: 'BUNDLE_MANIFEST_INVALID',
    })
  })

  it('rejects a manifest mutated after promotion', async () => {
    const members = JSON.parse(manifest()).members
    const promotedManifest = manifest()
    const proof = signedPayload(promotedManifest, { snapshot_seq: 4 })
    members[0].checksum = 'not-a-checksum'
    await expect(
      resolveBundlePin(
        databaseFor({
          bundle_id: 'bundle-1',
          snapshot_seq: 4,
          manifest_json: JSON.stringify({
            source_families: ['application'],
            members,
          }),
          integrity_payload_json: proof.payload,
          integrity_signature: proof.signature,
        }),
        ANALYSIS_BUNDLE_CONTRACT,
        pin,
      ),
    ).rejects.toMatchObject({ code: 'PINNED_BUNDLE_GONE' })
  })

  it.each([
    ['wrong key', { integrity_key_id: 'unknown' }],
    ['bad signature', { integrity_signature: 'not-base64' }],
    ['payload identity', { integrity_payload_json: JSON.stringify({ bundle_id: 'forged' }) }],
    ['missing payload', { integrity_payload_json: null }],
  ])('rejects %s signed proof forgery', async (_name, override) => {
    const manifestJson = manifest()
    await expect(
      resolveBundlePin(
        databaseFor({
          bundle_id: 'bundle-1',
          snapshot_seq: 4,
          manifest_json: manifestJson,
          ...override,
        }),
        ANALYSIS_BUNDLE_CONTRACT,
        pin,
      ),
    ).rejects.toMatchObject({ code: 'PINNED_BUNDLE_GONE' })
  })

  it('fails closed when a signed member physical value is changed', async () => {
    const base = databaseFor({ bundle_id: 'bundle-1', snapshot_seq: 0, manifest_json: manifest() })
    const tampered: PublicationDatabase = {
      ...base,
      query: async <Row extends Record<string, unknown>>(
        statement: string,
        values: readonly unknown[],
      ) => {
        if (statement.startsWith('SELECT COUNT(*)') && statement.includes('bundle_experiments')) {
          return [{ row_count: 1, physical_digest: PHYSICAL_DIGEST }] as unknown as Row[]
        }
        return base.query<Row>(statement, values)
      },
    }
    await expect(resolveBundlePin(tampered, ANALYSIS_BUNDLE_CONTRACT, pin)).rejects.toMatchObject({ code: 'PINNED_BUNDLE_GONE' })
  })

  it('fails closed after key revocation', async () => {
    const database = databaseFor({ bundle_id: 'bundle-1', snapshot_seq: 0, manifest_json: manifest() })
    await expect(resolveBundlePin(database, ANALYSIS_BUNDLE_CONTRACT, pin)).resolves.toMatchObject({ bundleId: 'bundle-1' })
    process.env.UNITBENCH_BUNDLE_INTEGRITY_PUBLIC_KEYS = JSON.stringify({})
    await expect(resolveBundlePin(database, ANALYSIS_BUNDLE_CONTRACT, pin)).rejects.toMatchObject({ code: 'PINNED_BUNDLE_GONE' })
    process.env.UNITBENCH_BUNDLE_INTEGRITY_PUBLIC_KEYS = JSON.stringify({ [KEY_ID]: TEST_PUBLIC_KEY })
  })
})

describe('acquireBundlePin', () => {
  it('pins only the destination current promoted bundle', async () => {
    const statements: string[] = []
    const database: PublicationDatabase = {
      query: async <Row extends Record<string, unknown>>(
        statement: string,
        values: readonly unknown[],
      ) => {
        void values
        statements.push(statement)
        if (statement.startsWith('SELECT bundle_id FROM')) {
          return [{ bundle_id: 'bundle-current' }] as unknown as Row[]
        }
        if (statement.startsWith('SELECT bundle_id FROM dr_platform_publication_state_bundles')) {
          return [{ bundle_id: 'bundle-current' }] as unknown as Row[]
        }
        if (statement.startsWith('INSERT INTO')) {
          return [{ expires_at_ms: '1234' }] as unknown as Row[]
        }
        return [] as Row[]
      },
      transaction: async (operation) => operation(database),
    }

    const acquired = await acquireBundlePin(
      database,
      ANALYSIS_BUNDLE_CONTRACT,
      'motherduck-analysis',
      60,
    )

    expect(acquired).toMatchObject({
      destinationId: 'motherduck-analysis',
      bundleKey: 'whetstone-analysis',
      bundleId: 'bundle-current',
      expiresAtMs: 1234,
    })
    expect(statements).toHaveLength(3)
    expect(statements[1]).toContain("status = 'PROMOTED'")
  })

  it('does not create a pin when the destination has no current bundle', async () => {
    const database: PublicationDatabase = {
      query: async <Row extends Record<string, unknown>>(
        statement: string,
        values: readonly unknown[],
      ) => {
        void statement
        void values
        return [] as Row[]
      },
      transaction: async (operation) => operation(database),
    }

    await expect(
      acquireBundlePin(database, ANALYSIS_BUNDLE_CONTRACT, 'motherduck-analysis'),
    ).rejects.toMatchObject({ code: 'BUNDLE_NOT_PUBLISHED' })
  })
})

describe('releaseBundlePin', () => {
  it('deletes only the exact pin after a reader is finished', async () => {
    const calls: unknown[][] = []
    const database: PublicationDatabase = {
      query: async <Row extends Record<string, unknown>>(
        statement: string,
        values: readonly unknown[],
      ) => {
        expect(statement).toMatch(/^DELETE FROM dr_platform_publication_state_pins/)
        calls.push([...values])
        return [] as Row[]
      },
      transaction: async (operation) => operation(database),
    }
    await releaseBundlePin(database, pin)
    expect(calls).toEqual([[pin.destinationId, pin.bundleKey, pin.pinId, pin.bundleId]])
  })
})
