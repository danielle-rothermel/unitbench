import { describe, expect, it } from 'vitest'
import {
  analysisDatabaseUrl,
  detailDatabaseUrl,
  MissingStoreConfigurationError,
  publicationStoreConfiguration,
  storeReadiness,
} from '@/lib/store-environment.server'

describe('storeReadiness', () => {
  it.each([
    {
      name: 'reports both stores missing independently',
      environment: {},
      expected: { analysis: 'missing', detail: 'missing' },
    },
    {
      name: 'keeps Detail available when Analysis is missing',
      environment: { DATABASE_URL: 'postgres://detail', DETAIL_PUBLICATION_DESTINATION_ID: 'neon-detail' },
      expected: { analysis: 'missing', detail: 'configured' },
    },
    {
      name: 'keeps Analysis available when Detail is missing',
      environment: { ANALYSIS_DATABASE_URL: 'postgres://analysis', ANALYSIS_PUBLICATION_DESTINATION_ID: 'motherduck-analysis' },
      expected: { analysis: 'configured', detail: 'missing' },
    },
    {
      name: 'reports both stores configured',
      environment: {
        ANALYSIS_DATABASE_URL: 'postgres://analysis',
        DATABASE_URL: 'postgres://detail',
        ANALYSIS_PUBLICATION_DESTINATION_ID: 'motherduck-analysis',
        DETAIL_PUBLICATION_DESTINATION_ID: 'neon-detail',
      },
      expected: { analysis: 'configured', detail: 'configured' },
    },
  ])('$name', ({ environment, expected }) => {
    expect(storeReadiness(environment)).toEqual(expected)
  })

  it('fails only the requested Analysis boundary', () => {
    const environment = { DATABASE_URL: 'postgres://detail' }

    expect(() => analysisDatabaseUrl(environment)).toThrow(
      new MissingStoreConfigurationError('analysis'),
    )
    expect(detailDatabaseUrl(environment)).toBe('postgres://detail')
  })

  it('fails only the requested Detail boundary', () => {
    const environment = { ANALYSIS_DATABASE_URL: 'postgres://analysis' }

    expect(analysisDatabaseUrl(environment)).toBe('postgres://analysis')
    expect(() => detailDatabaseUrl(environment)).toThrow(
      new MissingStoreConfigurationError('detail'),
    )
  })

  it('requires a destination-local identity before pinning a bundle', () => {
    const environment = { ANALYSIS_DATABASE_URL: 'postgres://analysis' }

    expect(() => publicationStoreConfiguration('analysis', environment)).toThrow(
      new MissingStoreConfigurationError(
        'analysis',
        'ANALYSIS_PUBLICATION_DESTINATION_ID',
      ),
    )
    expect(
      publicationStoreConfiguration('analysis', {
        ...environment,
        ANALYSIS_PUBLICATION_DESTINATION_ID: 'motherduck-analysis',
      }),
    ).toEqual({
      plane: 'analysis',
      databaseUrl: 'postgres://analysis',
      destinationId: 'motherduck-analysis',
    })
  })
})
