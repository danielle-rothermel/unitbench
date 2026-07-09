import createClient from 'openapi-fetch'
import type { components, paths } from '@/lib/api/dr-code'

export const DR_CODE_SERVE_URL =
  process.env.NEXT_PUBLIC_DR_CODE_SERVE_URL ?? 'http://127.0.0.1:8321'

export type ExplainRequest = components['schemas']['ExplainRequest']
export type ExtractionExplanation =
  components['schemas']['ExtractionExplanation']
export type CandidateExplanation =
  components['schemas']['CandidateExplanation']
export type ExplainStage = components['schemas']['ExplainStage']

export const drCodeClient = createClient<paths>({
  baseUrl: DR_CODE_SERVE_URL,
})
