export const STORE_ENVIRONMENT_VARIABLES = {
  analysis: 'ANALYSIS_DATABASE_URL',
  detail: 'DATABASE_URL',
} as const

export const LOCAL_ANALYSIS_DATABASE_PATH = 'LOCAL_ANALYSIS_DATABASE_PATH'

export const PUBLICATION_DESTINATION_ENVIRONMENT_VARIABLES = {
  analysis: 'ANALYSIS_PUBLICATION_DESTINATION_ID',
  detail: 'DETAIL_PUBLICATION_DESTINATION_ID',
} as const

export type StorePlane = keyof typeof STORE_ENVIRONMENT_VARIABLES
export type StoreState = 'configured' | 'missing'

export type StoreReadiness = Readonly<Record<StorePlane, StoreState>>

export type StoreEnvironment = Readonly<{
  [key: string]: string | undefined
  ANALYSIS_DATABASE_URL?: string
  DATABASE_URL?: string
  ANALYSIS_PUBLICATION_DESTINATION_ID?: string
  DETAIL_PUBLICATION_DESTINATION_ID?: string
  LOCAL_ANALYSIS_DATABASE_PATH?: string
}>

function isConfigured(value: string | undefined): boolean {
  return value !== undefined && value.trim().length > 0
}

export function resolveStoreReadiness(
  environment: StoreEnvironment,
): StoreReadiness {
  return {
    analysis: isConfigured(environment.LOCAL_ANALYSIS_DATABASE_PATH) || isConfigured(environment.ANALYSIS_DATABASE_URL)
      ? 'configured'
      : 'missing',
    detail: isConfigured(environment.DATABASE_URL) ? 'configured' : 'missing',
  }
}
