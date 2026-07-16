import { createHash, createPrivateKey, sign as signPayload } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import numericVectors from '@/lib/platform-numeric-json-vectors.json'
import jsonChecksumVectors from '@/lib/platform-json-checksum-vectors.json'
import { ANALYSIS_BUNDLE_CONTRACT } from '@/lib/bundle-contract'
import {
  acquireBundlePin,
  BundlePinError,
  releaseBundlePin,
  resolveBundlePin,
  integrityCanonicalJson,
  platformChecksum,
  platformNumericJson,
  type PublicationDatabase,
} from '@/lib/bundle-pins.server'

const EMPTY_CHECKSUM = createHash('sha256').update('[]').digest('hex')
const PHYSICAL_DIGEST = createHash('sha256').update('').digest('hex')
const KEY_ID = 'test_ed25519'
const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEID4v6djRiugbIu3mOJMBQLqV5QGHI1V2AkVe/hp4OyAR
-----END PRIVATE KEY-----`
const TEST_PUBLIC_KEY = 'MCowBQYDK2VwAyEA0ezQwg8kdwyTQPHwHKuqmndPWfGfc8NuYCFsbma+y/Y='
const SOURCE_COORDINATES = [{
  source_id: 'application:unitbench',
  database_server: 'unitbench',
  captured_at: '2026-07-12T12:00:00Z',
  snapshot_seq: 0,
}]
const SOURCE_COORDINATES_JSON = JSON.stringify(SOURCE_COORDINATES)
const SOURCE_COORDINATES_SHA256 = createHash('sha256').update(integrityCanonicalJson(SOURCE_COORDINATES)).digest('hex')

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
    source_coordinates_sha256: SOURCE_COORDINATES_SHA256,
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
          source_coordinates_json: SOURCE_COORDINATES_JSON,
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
  it.each([
    [0, 'aa16ddc6070b66bccceef5084525341323ac0a1123deb2b71734dae7567f8718'],
    [1, 'd8218081624f0c131ca90f95eacf4ea88c7223f1a3aafce17199216d774d0c0c'],
    [-1, 'cef5217b8cc86cedce37648b304a2ad256ce9da3b0e7de67a61e0b1efd30c4fb'],
    ['9007199254740993', 'ae107e1bac8c2d6fe5f92938597971b8e515d6b6208d7fa6bcb33000faa410dc'],
  ])('preserves signed harness failure count %s without Number coercion', (value, checksum) => {
    const postgres = { harness_failure_count: String(value) }
    const duckdb = { harness_failure_count: BigInt(value) }
    expect(platformChecksum([postgres])).toBe(checksum)
    expect(platformChecksum([duckdb])).toBe(checksum)
  })
  it.each([
    ['timestamp exact second in Platform UTC wire form', { created_at: '2026-07-12T22:45:22+00:00' }, '2eb31d3e123f6d76b3aab5ec1c101c292cf9878cef73d241dd5400898742ea8c'],
    ['timestamp microseconds in Platform UTC wire form', { created_at: '2026-07-12T22:45:22.961426+00:00' }, 'a07951b8de2e45e907d4e095d79119ec2dd9e5eff661ef12f57d9aec64709b06'],
    ['numeric Decimal integral float marker', { pass_rate: '1.000' }, '243ccf84199a0b437183d721e61bfffb8155476b4c5aa9721107ae03ac5e9ad8'],
    ['numeric scientific lower boundary', { pass_rate: '0.0000001' }, '6e28ed06aa1b5b42d1bdee21eb92a4d6b64b3070aa485046d6f1fb3e1612d6bb'],
    ['numeric scientific upper boundary', { pass_rate: '10000000000000000' }, 'de77f7efdc436eae01138d6e3fa66b64321563b345b67489a7509e932fdb0905'],
    ['negative numeric zero', { pass_rate: '-0.0' }, '438ed09966df69acb4eadafe652f1196b5853160ae07c3679e27485f0c81a780'],
    ['structured JSON', { config_json: '{"z":null,"a":[2,1]}' }, '906287802b561b63b5cb7623bb059559d4f0a7c0d45e1feeef4384ac934932e3'],
    ['structured JSON recursive floats', { config_json: '{"safe":[2],"numeric_vectors":[0.0000123,12340000000000000]}' }, '522bbf38f6b3d382d44643d71504c350b20df1171f0400cb440e46057554b311'],
    ['UUID text', { uuid_text: '550e8400-e29b-41d4-a716-446655440000' }, '52414fe6d62cd0903a737480f045e8f3c256e8c962974dabe65867466fc9e724'],
    ['null', { nullable: null }, '66c232bae1866bde30c34d3af616d886dff65c8c364a76bbc2d58a9cfe432733'],
    ['boolean', { enabled: true }, 'f4ee039b3f1ad510060792dd29550fe7b98ed9eedb4441df0c94aaa52e80ee1a'],
  ])('matches Platform canonical checksum for %s', (_name, row, checksum) => {
    expect(platformChecksum([row])).toBe(checksum)
  })

  it('matches every Python-authored finite float JSON spelling vector', () => {
    for (const vector of numericVectors) {
      expect(platformNumericJson(vector.input), vector.name).toBe(vector.expected)
    }
  })

  it('matches Python-authored lossless structured JSON checksum vectors', () => {
    for (const vector of jsonChecksumVectors) {
      expect(platformChecksum([{ config_json: vector.json }]), vector.name).toBe(vector.expected)
    }
  })

  it.each([
    '{"number":01}',
    '{"number":1e9999}',
    '{"number":NaN}',
    '{"number":Infinity}',
    '{"number":-Infinity}',
    '{"unterminated":"value}',
  ])('rejects non-standard or non-finite structured JSON: %s', (configJson) => {
    expect(() => platformChecksum([{ config_json: configJson }])).toThrow(BundlePinError)
  })

  it.each(['NaN', 'Infinity', '-Infinity'])('rejects non-finite numeric values', (value) => {
    expect(() => platformNumericJson(value)).toThrow(BundlePinError)
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

  it.each([
    ['coordinates', { source_coordinates_json: JSON.stringify([{ ...SOURCE_COORDINATES[0], database_server: 'forged' }]) }],
    ['source families', { manifest_json: manifest({ source_families: ['dbos'] }) }],
  ])('rejects mutated remote %s provenance', async (_name, mutation) => {
    await expect(resolveBundlePin(
      databaseFor({ bundle_id: 'bundle-1', snapshot_seq: 0, manifest_json: manifest(), ...mutation }),
      ANALYSIS_BUNDLE_CONTRACT,
      pin,
    )).rejects.toMatchObject({ code: 'PINNED_BUNDLE_GONE' })
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
