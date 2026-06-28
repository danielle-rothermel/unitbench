import { neon } from '@neondatabase/serverless'

export type DatabaseStatus =
  | { status: 'missing-url' }
  | { status: 'ok' }
  | { status: 'error'; message: string }

export class MissingDatabaseUrlError extends Error {
  constructor() {
    super('DATABASE_URL is not configured.')
    this.name = 'MissingDatabaseUrlError'
  }
}

export type SqlClient = ReturnType<typeof neon>

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) throw new MissingDatabaseUrlError()
  return url
}

export function neonSql(): SqlClient {
  return neon(databaseUrl())
}

export async function getConnectionStatus(): Promise<DatabaseStatus> {
  try {
    const sql = neonSql()
    await sql`SELECT 1`
    return { status: 'ok' }
  } catch (error) {
    if (error instanceof MissingDatabaseUrlError) {
      return { status: 'missing-url' }
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    }
  }
}
