import 'server-only'

export const REMOTE_COMPUTE_POLICIES = ['ALLOW', 'CONFIRM', 'LOCAL_ONLY'] as const
export type RemoteComputePolicy = (typeof REMOTE_COMPUTE_POLICIES)[number]

export class RemoteComputePolicyError extends Error {
  constructor(readonly policy: RemoteComputePolicy) {
    super(`Remote Analysis compute is not permitted by ${policy}.`)
    this.name = 'RemoteComputePolicyError'
  }
}

/** Fail closed before SQL leaves the process. CONFIRM is an explicit caller acknowledgement. */
export function enforceRemoteComputePolicy(
  policy: RemoteComputePolicy,
  isLocal: boolean,
  confirmed = false,
): void {
  if (isLocal || policy === 'ALLOW' || (policy === 'CONFIRM' && confirmed)) return
  throw new RemoteComputePolicyError(policy)
}
