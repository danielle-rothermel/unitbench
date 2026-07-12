import type { BundleReadError } from '@/lib/bundle-adapter.server'
import type { PinnedBundle } from '@/lib/bundle-pins.server'

export type BundleIdentity = Readonly<{
  bundle_id: string
  snapshot_seq: number
}>

export type BundleViewFailure = BundleReadError['code']

export function bundleIdentity(bundle: Pick<PinnedBundle, 'bundleId' | 'snapshotSeq'>): BundleIdentity {
  return { bundle_id: bundle.bundleId, snapshot_seq: bundle.snapshotSeq }
}

export function bundleFailure(error: unknown): BundleViewFailure {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code
    if (
      code === 'STORE_NOT_CONFIGURED' ||
      code === 'BUNDLE_NOT_PUBLISHED' ||
      code === 'PIN_EXPIRED_OR_GONE' ||
      code === 'BUNDLE_MANIFEST_INVALID' ||
      code === 'BUNDLE_INTEGRITY_FAILED' ||
      code === 'DESTINATION_UNAVAILABLE' ||
      code === 'BUNDLE_CONTRACT_INCOMPATIBLE' ||
      code === 'INTERNAL_READ_ERROR'
    ) return code
  }
  return 'INTERNAL_READ_ERROR'
}
