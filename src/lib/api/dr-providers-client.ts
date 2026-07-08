import createClient from 'openapi-fetch'
import type { components, paths } from '@/lib/api/dr-providers'

export const DR_PROVIDERS_SERVE_URL =
  process.env.NEXT_PUBLIC_DR_PROVIDERS_SERVE_URL ?? 'http://127.0.0.1:8322'

export type QuerySpec = components['schemas']['QuerySpec']
export type QueryResult = components['schemas']['QueryResult']
export type ProviderChoice = components['schemas']['ProviderChoice']
export type ProviderChoiceKind = components['schemas']['ProviderChoiceKind']
export type ReasoningEffort = components['schemas']['ReasoningEffort']
export type FixtureOutcomeSpec = components['schemas']['FixtureOutcomeSpec']
export type VarianceReport = components['schemas']['VarianceReport']
export type VarianceRecord = components['schemas']['VarianceRecord']
export type ServeProviderKind = components['schemas']['ServeProviderKind']

export const drProvidersClient = createClient<paths>({
  baseUrl: DR_PROVIDERS_SERVE_URL,
})
