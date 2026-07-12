import 'server-only'

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

export class BundleReadError extends Error {
  readonly code:
    | 'STORE_NOT_CONFIGURED'
    | 'BUNDLE_NOT_PUBLISHED'
    | 'PIN_EXPIRED_OR_GONE'
    | 'BUNDLE_MANIFEST_INVALID'
    | 'BUNDLE_INTEGRITY_FAILED'
    | 'DESTINATION_UNAVAILABLE'

  constructor(code: BundleReadError['code']) {
    super(code)
    this.name = 'BundleReadError'
    this.code = code
  }
}

function toBundleReadError(error: unknown): BundleReadError {
  if (error instanceof BundlePinError) return new BundleReadError(error.code)
  if (error instanceof MissingStoreConfigurationError) {
    return new BundleReadError('STORE_NOT_CONFIGURED')
  }
  return new BundleReadError('DESTINATION_UNAVAILABLE')
}

async function withBundle<Members extends string, Result>(
  plane: BundleReadPlane,
  operation: (
    database: PublicationDatabase,
    bundle: PinnedBundle<Members & (AnalysisBundleMember | DetailBundleMember)>,
  ) => Promise<Result>,
): Promise<Result> {
  try {
    return await withConfiguredPinnedBundle(plane, operation as never)
  } catch (error) {
    throw toBundleReadError(error)
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
