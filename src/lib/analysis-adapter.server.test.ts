import { describe, expect, it } from 'vitest'
import {
  AmbiguousAnalysisStoreConfigurationError,
  configuredAnalysisAdapter,
} from '@/lib/analysis-adapter.server'

describe('configuredAnalysisAdapter', () => {
  it('rejects ambiguous local and remote Analysis selection', () => {
    expect(() => configuredAnalysisAdapter({
      LOCAL_ANALYSIS_DATABASE_PATH: '/tmp/analysis.duckdb',
      ANALYSIS_DATABASE_URL: 'postgres://analysis',
    } as unknown as NodeJS.ProcessEnv)).toThrow(AmbiguousAnalysisStoreConfigurationError)
  })
})
