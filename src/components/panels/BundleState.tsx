import { ErrorSection } from '@/components/panels/ErrorSection'
import type { BundleViewFailure } from '@/lib/bundle-view'

type BundleStateProps = { plane: 'Analysis' | 'Detail'; failure: BundleViewFailure }

const COPY: Record<BundleViewFailure, { title: string; message: string; tone?: 'setup' | 'error' }> = {
  STORE_NOT_CONFIGURED: { title: 'Store not configured', message: 'This server does not have the required store configuration.', tone: 'setup' },
  BUNDLE_NOT_PUBLISHED: { title: 'No published bundle', message: 'A current published bundle is not available for this view.' },
  PIN_EXPIRED_OR_GONE: { title: 'Pinned bundle expired', message: 'The published version changed before this view could be read. Refresh to try again.' },
  BUNDLE_MANIFEST_INVALID: { title: 'Bundle is incompatible', message: 'The published bundle does not match this version of Unitbench.' },
  BUNDLE_INTEGRITY_FAILED: { title: 'Bundle verification failed', message: 'The published bundle did not pass its integrity check.' },
  DESTINATION_UNAVAILABLE: { title: 'Destination unavailable', message: 'The published data destination could not be reached. Try again shortly.' },
  BUNDLE_CONTRACT_INCOMPATIBLE: { title: 'Bundle is incompatible', message: 'The published data does not match this version of Unitbench.' },
  INTERNAL_READ_ERROR: { title: 'Unable to load bundle', message: 'The published data could not be read. Try again later or contact the service owner.' },
}

export function BundleState({ plane, failure }: BundleStateProps) {
  const copy = COPY[failure]
  return <ErrorSection tone={copy.tone} title={`${plane}: ${copy.title}`} message={copy.message} />
}
