import 'server-only'

export type ParityPlaneEvidence = Readonly<{
  destinationId: string; bundleId: string; snapshotSeq: number; pinId: string
  members: Record<string, string>; memberCounts: Record<string, number>
}>

export type ReleaseParityDescriptor = Readonly<{
  version: 1; fixtureHash: string
  local: Readonly<{ analysis: ParityPlaneEvidence; detail: ParityPlaneEvidence }>
  remote: Readonly<{ analysis: ParityPlaneEvidence; detail: ParityPlaneEvidence }>
  cleanup: Readonly<{ localRemoved: boolean; remoteMetadataCounts: Readonly<{ state: number; bundles: number; pins: number }>; remotePhysicalMembers: number }>
  queryEvidence: readonly Readonly<{ id: string; fingerprint: string }>[]
}>

/** Validates only producer evidence; Unitbench never writes publication state. */
export function parseReleaseParityDescriptor(value: unknown, requiredMembers: readonly string[]): ReleaseParityDescriptor {
  if (!value || typeof value !== 'object') throw new Error('delivery parity evidence is absent')
  const descriptor = value as ReleaseParityDescriptor
  if (descriptor.version !== 1 || !/^[a-f0-9]{12,64}$/.test(descriptor.fixtureHash)) throw new Error('delivery parity fixture hash is invalid')
  for (const side of [descriptor.local, descriptor.remote]) for (const plane of ['analysis', 'detail'] as const) {
    const evidence = side?.[plane]
    if (!evidence || !evidence.destinationId || !evidence.bundleId || !evidence.pinId || !Number.isSafeInteger(evidence.snapshotSeq)) throw new Error(`delivery parity ${plane} identity evidence is absent`)
    if (requiredMembers.some(key => !evidence.members?.[key] || !Number.isSafeInteger(evidence.memberCounts?.[key]) || evidence.memberCounts[key] <= 0)) throw new Error(`delivery parity ${plane} fixture is empty or incomplete`)
  }
  if (descriptor.local.analysis.bundleId !== descriptor.remote.analysis.bundleId || descriptor.local.analysis.snapshotSeq !== descriptor.remote.analysis.snapshotSeq || descriptor.local.detail.bundleId !== descriptor.remote.detail.bundleId || descriptor.local.detail.snapshotSeq !== descriptor.remote.detail.snapshotSeq) throw new Error('delivery parity bundle identity mismatch')
  if (!descriptor.cleanup?.localRemoved || descriptor.cleanup.remoteMetadataCounts.state !== 0 || descriptor.cleanup.remoteMetadataCounts.bundles !== 0 || descriptor.cleanup.remoteMetadataCounts.pins !== 0 || descriptor.cleanup.remotePhysicalMembers !== 0) throw new Error('delivery parity cleanup evidence is absent or incomplete')
  return descriptor
}
