export const STORE_ENVIRONMENT_VARIABLES = {
  analysis: 'ANALYSIS_DATABASE_URL',
  detail: 'DATABASE_URL',
} as const

export type StorePlane = keyof typeof STORE_ENVIRONMENT_VARIABLES
export type StoreState = 'configured' | 'missing'

export type StoreReadiness = Readonly<Record<StorePlane, StoreState>>

export type StoreEnvironment = Readonly<{
  [key: string]: string | undefined
  ANALYSIS_DATABASE_URL?: string
  DATABASE_URL?: string
}>

function isConfigured(value: string | undefined): boolean {
  return value !== undefined && value.trim().length > 0
}

export function resolveStoreReadiness(
  environment: StoreEnvironment,
): StoreReadiness {
  return {
    analysis: isConfigured(environment.ANALYSIS_DATABASE_URL)
      ? 'configured'
      : 'missing',
    detail: isConfigured(environment.DATABASE_URL) ? 'configured' : 'missing',
  }
}
