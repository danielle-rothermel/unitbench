import 'server-only'

import { createRequire } from 'node:module'
import postgres from 'postgres'
import type { PublicationDatabase } from '@/lib/bundle-pins.server'
import { enforceRemoteComputePolicy, type RemoteComputePolicy } from '@/lib/analysis-policy.server'

export type AnalysisAdapter = PublicationDatabase & Readonly<{ kind: 'duckdb' | 'postgres' }>

export class AmbiguousAnalysisStoreConfigurationError extends Error {
  constructor() {
    super('Configure either LOCAL_ANALYSIS_DATABASE_PATH or ANALYSIS_DATABASE_URL, not both.')
    this.name = 'AmbiguousAnalysisStoreConfigurationError'
  }
}

export function localDuckDbAdapter(path: string): AnalysisAdapter {
  // Load the native binding only when local Analysis is selected. Remote
  // deployments must not require a DuckDB binary in their server bundle.
  const moduleName = ['duck', 'db'].join('')
  const duckdb = createRequire(import.meta.url)(moduleName) as {
    Database: new (databasePath: string) => {
      all(statement: string, ...args: unknown[]): void
      close(): void
    }
  }
  const database = new duckdb.Database(path)
  const query = <Row extends Record<string, unknown>>(statement: string, values: readonly unknown[]) =>
    new Promise<readonly Row[]>((resolve, reject) => {
      database.all(statement, ...values, (error: Error | null, rows: Row[]) => error ? reject(error) : resolve(rows))
    })
  const adapter: AnalysisAdapter = {
    kind: 'duckdb', query,
    transaction: async operation => {
      await query('BEGIN TRANSACTION', [])
      try { const result = await operation(adapter); await query('COMMIT', []); return result }
      catch (error) { await query('ROLLBACK', []); throw error }
    },
    close: async () => { database.close() },
  }
  return adapter
}

export function postgresPublicationAdapter(url: string): AnalysisAdapter {
  const sql = postgres(url, { connect_timeout: 10, idle_timeout: 20, max: 1 })
  const adapter: AnalysisAdapter = {
    kind: 'postgres',
    query: async <Row extends Record<string, unknown>>(statement: string, values: readonly unknown[]) =>
      sql.unsafe(statement, values as never[]) as Promise<readonly Row[]>,
    transaction: async operation => sql.begin(async transaction => operation({
      query: async <Row extends Record<string, unknown>>(statement: string, values: readonly unknown[]) =>
        transaction.unsafe(statement, values as never[]) as Promise<readonly Row[]>,
      transaction: async nested => nested(adapter),
    })) as Promise<Awaited<ReturnType<typeof operation>>>,
    close: () => sql.end({ timeout: 5 }),
  }
  return adapter
}

export function configuredAnalysisAdapter(
  environment: NodeJS.ProcessEnv = process.env,
  policy: RemoteComputePolicy = 'ALLOW',
  confirmed = false,
): AnalysisAdapter {
  const localPath = environment.LOCAL_ANALYSIS_DATABASE_PATH?.trim()
  const remoteUrl = environment.ANALYSIS_DATABASE_URL?.trim()
  if (localPath && remoteUrl) throw new AmbiguousAnalysisStoreConfigurationError()
  if (localPath) return localDuckDbAdapter(localPath)
  enforceRemoteComputePolicy(policy, false, confirmed)
  if (!remoteUrl) throw new Error('ANALYSIS_DATABASE_URL is not configured.')
  return postgresPublicationAdapter(remoteUrl)
}
