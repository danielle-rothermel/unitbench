import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { ANALYSIS_BUNDLE_CONTRACT } from '@/lib/bundle-contract'
import {
  acquireBundlePin,
  BundlePinError,
  resolveBundlePin,
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

  it('rejects a member checksum mismatch', async () => {
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
      code: 'BUNDLE_INTEGRITY_FAILED',
    })
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
