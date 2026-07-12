import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { ANALYSIS_BUNDLE_CONTRACT } from '@/lib/bundle-contract'
import {
  acquireBundlePin,
  BundlePinError,
  resolveBundlePin,
  platformChecksum,
  type PublicationDatabase,
} from '@/lib/bundle-pins.server'

const EMPTY_CHECKSUM = createHash('sha256').update('[]').digest('hex')

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
      column_schema: [{ name: 'bundle_id', type: 'text' }],
    })),
    ...overrides,
  })
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
        return (published ? [published] : []) as Row[]
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

describe('resolveBundlePin', () => {
  it('matches a fixed dr-platform publisher checksum vector', () => {
    const postgresRows = [{
      created_at: '2026-07-12T12:34:56Z', integer_value: '42', decimal_value: '0.125',
      payload: '{"score":"001","z":null}',
    }]
    const duckdbRows = [{
      created_at: new Date('2026-07-12T12:34:56Z'), integer_value: '42', decimal_value: 0.125,
      payload: { score: '001', z: null },
    }]
    const schema = [
      { name: 'created_at', type: 'timestamp' }, { name: 'integer_value', type: 'integer' },
      { name: 'decimal_value', type: 'numeric' }, { name: 'payload', type: 'json' },
    ] as const
    const publisherChecksum = 'f3839d90a868300be03df971783bce4e9d8d3ab142be7a0cb2e7672ed3949845'
    expect(platformChecksum(postgresRows, schema)).toBe(publisherChecksum)
    expect(platformChecksum(duckdbRows, schema)).toBe(publisherChecksum)
  })
  it('accepts only a complete, checksummed application bundle', async () => {
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

  it('resolves the promoted pin without request-time member scans', async () => {
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

  it('rejects malformed member checksums before allowing a pinned read', async () => {
    const members = JSON.parse(manifest()).members
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
        }),
        ANALYSIS_BUNDLE_CONTRACT,
        pin,
      ),
    ).rejects.toMatchObject({
      code: 'BUNDLE_MANIFEST_INVALID',
    })
  })

  it('does not materialize rows to recheck promoted member counts', async () => {
    const members = JSON.parse(manifest()).members
    members[0].row_count = 1
    await expect(
      resolveBundlePin(
        databaseFor({
          bundle_id: 'bundle-1',
          snapshot_seq: 4,
          manifest_json: JSON.stringify({ source_families: ['application'], members }),
        }),
        ANALYSIS_BUNDLE_CONTRACT,
        pin,
      ),
    ).resolves.toMatchObject({ bundleId: 'bundle-1' })
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
