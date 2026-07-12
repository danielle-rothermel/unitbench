import 'server-only'

import {
  resolveStoreReadiness,
  STORE_ENVIRONMENT_VARIABLES,
  type StoreEnvironment,
  type StorePlane,
  type StoreReadiness,
} from '@/lib/store-readiness'

export class MissingStoreConfigurationError extends Error {
  readonly plane: StorePlane
  readonly environmentVariable: string

  constructor(plane: StorePlane) {
    const environmentVariable = STORE_ENVIRONMENT_VARIABLES[plane]
    super(`${environmentVariable} is not configured.`)
    this.name = 'MissingStoreConfigurationError'
    this.plane = plane
    this.environmentVariable = environmentVariable
  }
}

function requiredStoreUrl(
  plane: StorePlane,
  environment: StoreEnvironment,
): string {
  const value = environment[STORE_ENVIRONMENT_VARIABLES[plane]]
  if (!value || value.trim().length === 0) {
    throw new MissingStoreConfigurationError(plane)
  }
  return value
}

export function analysisDatabaseUrl(
  environment: StoreEnvironment = process.env,
): string {
  return requiredStoreUrl('analysis', environment)
}

export function detailDatabaseUrl(
  environment: StoreEnvironment = process.env,
): string {
  return requiredStoreUrl('detail', environment)
}

export function storeReadiness(
  environment: StoreEnvironment = process.env,
): StoreReadiness {
  return resolveStoreReadiness(environment)
}
