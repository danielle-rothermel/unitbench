import 'server-only'

import { AsyncLocalStorage } from 'node:async_hooks'
import type {
  AnalysisBundleMember,
  DetailBundleMember,
} from '@/lib/bundle-contract'
import {
  BundlePinError,
  withConfiguredPinnedBundle,
  type PinnedBundle,
  type PublicationDatabase,
} from '@/lib/bundle-pins.server'
import { MissingStoreConfigurationError } from '@/lib/store-environment.server'

type BundleReadPlane = 'analysis' | 'detail'

export type ResolvedParityBundle = Readonly<{
  database: PublicationDatabase
  bundle: PinnedBundle<AnalysisBundleMember> | PinnedBundle<DetailBundleMember>
}>

const parityBundles = new AsyncLocalStorage<Readonly<Record<BundleReadPlane, ResolvedParityBundle>>>()

/** Runs production loaders against already-resolved, read-only parity pins. */
export async function withResolvedParityBundles<Result>(
  bundles: Readonly<Record<BundleReadPlane, ResolvedParityBundle>>,
  operation: () => Promise<Result>,
): Promise<Result> {
  return parityBundles.run(bundles, operation)
}

export class BundleReadError extends Error {
  readonly code:
    | 'STORE_NOT_CONFIGURED'
    | 'BUNDLE_NOT_PUBLISHED'
    | 'PIN_EXPIRED_OR_GONE'
    | 'BUNDLE_MANIFEST_INVALID'
    | 'PINNED_BUNDLE_GONE'
    | 'DESTINATION_UNAVAILABLE'
    | 'BUNDLE_CONTRACT_INCOMPATIBLE'
    | 'INTERNAL_READ_ERROR'

  constructor(code: BundleReadError['code']) {
    super(code)
    this.name = 'BundleReadError'
    this.code = code
  }
}

type DatabaseError = Readonly<{
  code?: unknown
  errno?: unknown
  message?: unknown
  name?: unknown
}>

const CONTRACT_SQL_STATES = new Set(['42P01', '42703', '42804'])
const TRANSIENT_NETWORK_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ECONNABORTED',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ETIMEDOUT',
])

function databaseErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined
  const { code, errno } = error as DatabaseError
  if (typeof code === 'string') return code
  if (typeof errno === 'string') return errno
  return undefined
}

function safeDiagnosticCode(error: unknown): string | undefined {
  const code = databaseErrorCode(error)
  return code && /^[A-Z0-9_]{1,32}$/.test(code) ? code : undefined
}

/** Classifies only stable, actionable destination errors; everything else stays internal. */
export function toBundleReadError(error: unknown): BundleReadError {
  if (error instanceof BundlePinError) return new BundleReadError(error.code)
  if (error instanceof MissingStoreConfigurationError) {
    return new BundleReadError('STORE_NOT_CONFIGURED')
  }
  const code = databaseErrorCode(error)
  if (code && CONTRACT_SQL_STATES.has(code)) {
    return new BundleReadError('BUNDLE_CONTRACT_INCOMPATIBLE')
  }
  if (code?.startsWith('08') || (code && TRANSIENT_NETWORK_CODES.has(code))) {
    return new BundleReadError('DESTINATION_UNAVAILABLE')
  }
  return new BundleReadError('INTERNAL_READ_ERROR')
}

export function redactBundleReadDiagnostic(value: string): string {
  return value
    .replace(/\b(?:postgres(?:ql)?|mysql|https?):\/\/[^\s'"`]+/gi, '[redacted-url]')
    .replace(/\b(password|passwd|token|secret|api[_-]?key)\s*=\s*[^\s,;]+/gi, '$1=[redacted]')
}

function logBundleReadFailure(plane: BundleReadPlane, error: unknown, classified: BundleReadError): void {
  const record = typeof error === 'object' && error !== null ? error as DatabaseError : undefined
  const message = record && typeof record.message === 'string'
    ? redactBundleReadDiagnostic(record.message)
    : undefined
  console.error('Unitbench bundle read failed', {
    plane,
    classification: classified.code,
    database_code: safeDiagnosticCode(error),
    message,
  })
}

async function withBundle<Members extends string, Result>(
  plane: BundleReadPlane,
  operation: (
    database: PublicationDatabase,
    bundle: PinnedBundle<Members & (AnalysisBundleMember | DetailBundleMember)>,
  ) => Promise<Result>,
): Promise<Result> {
  try {
    const resolved = parityBundles.getStore()?.[plane]
    if (resolved) return await operation(resolved.database, resolved.bundle as PinnedBundle<Members & (AnalysisBundleMember | DetailBundleMember)>)
    return await withConfiguredPinnedBundle(plane, operation as never)
  } catch (error) {
    const classified = toBundleReadError(error)
    logBundleReadFailure(plane, error, classified)
    throw classified
  }
}

export function withAnalysisBundle<Result>(
  operation: (
    database: PublicationDatabase,
    bundle: PinnedBundle<AnalysisBundleMember>,
  ) => Promise<Result>,
): Promise<Result> {
  return withBundle('analysis', operation)
}

export function withDetailBundle<Result>(
  operation: (
    database: PublicationDatabase,
    bundle: PinnedBundle<DetailBundleMember>,
  ) => Promise<Result>,
): Promise<Result> {
  return withBundle('detail', operation)
}
