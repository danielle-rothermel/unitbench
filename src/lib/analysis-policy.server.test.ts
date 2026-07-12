import { describe, expect, it } from 'vitest'
import { enforceRemoteComputePolicy, RemoteComputePolicyError } from '@/lib/analysis-policy.server'

describe('remote analysis compute policy', () => {
  it('allows an explicit ALLOW policy', () => {
    expect(() => enforceRemoteComputePolicy('ALLOW', false)).not.toThrow()
  })

  it('requires an explicit confirmation before remote CONFIRM work', () => {
    expect(() => enforceRemoteComputePolicy('CONFIRM', false)).toThrow(RemoteComputePolicyError)
    expect(() => enforceRemoteComputePolicy('CONFIRM', false, true)).not.toThrow()
  })

  it('fails closed for LOCAL_ONLY on a remote adapter but permits local work', () => {
    expect(() => enforceRemoteComputePolicy('LOCAL_ONLY', false)).toThrow(RemoteComputePolicyError)
    expect(() => enforceRemoteComputePolicy('LOCAL_ONLY', true)).not.toThrow()
  })
})
