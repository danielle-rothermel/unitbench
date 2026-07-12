import { describe, expect, it } from 'vitest'
import {
  ANALYSIS_BUNDLE_CONTRACT,
  DETAIL_BUNDLE_CONTRACT,
  bundleContract,
} from '@/lib/bundle-contract'

describe('v6 publication bundle contracts', () => {
  it('freezes the authoritative Analysis inventory', () => {
    expect(ANALYSIS_BUNDLE_CONTRACT).toEqual({
      plane: 'analysis',
      bundleKey: 'whetstone-analysis',
      members: [
        'experiments',
        'predictions',
        'generation_runs',
        'score_attempts',
        'sweep_metrics',
        'failure_metrics',
      ],
    })
  })

  it('freezes the root-cascaded Detail inventory', () => {
    expect(DETAIL_BUNDLE_CONTRACT).toEqual({
      plane: 'detail',
      bundleKey: 'whetstone-detail',
      members: [
        'detail_predictions',
        'detail_prediction_payloads',
        'detail_generation_runs',
        'detail_node_attempts',
        'detail_score_attempts',
        'detail_score_harness_failures',
        'detail_platform_attempts',
      ],
    })
    expect(bundleContract('detail')).toBe(DETAIL_BUNDLE_CONTRACT)
  })
})
