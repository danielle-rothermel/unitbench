export const ANALYSIS_BUNDLE_KEY = 'whetstone-analysis'
export const DETAIL_BUNDLE_KEY = 'whetstone-detail'

export const ANALYSIS_BUNDLE_MEMBERS = [
  'experiments',
  'predictions',
  'generation_runs',
  'score_attempts',
  'sweep_metrics',
  'failure_metrics',
] as const

export const DETAIL_BUNDLE_MEMBERS = [
  'detail_predictions',
  'detail_prediction_payloads',
  'detail_generation_runs',
  'detail_node_attempts',
  'detail_score_attempts',
  'detail_score_harness_failures',
  'detail_platform_attempts',
] as const

export type BundlePlane = 'analysis' | 'detail'
export type AnalysisBundleMember = (typeof ANALYSIS_BUNDLE_MEMBERS)[number]
export type DetailBundleMember = (typeof DETAIL_BUNDLE_MEMBERS)[number]
export type BundleMember = AnalysisBundleMember | DetailBundleMember

export type BundleContract<
  Plane extends BundlePlane = BundlePlane,
  Member extends BundleMember = BundleMember,
> = Readonly<{
  plane: Plane
  bundleKey: string
  members: readonly Member[]
}>

export const ANALYSIS_BUNDLE_CONTRACT: BundleContract<
  'analysis',
  AnalysisBundleMember
> = {
  plane: 'analysis',
  bundleKey: ANALYSIS_BUNDLE_KEY,
  members: ANALYSIS_BUNDLE_MEMBERS,
}

export const DETAIL_BUNDLE_CONTRACT: BundleContract<'detail', DetailBundleMember> = {
  plane: 'detail',
  bundleKey: DETAIL_BUNDLE_KEY,
  members: DETAIL_BUNDLE_MEMBERS,
}

export function bundleContract(plane: BundlePlane): BundleContract {
  return plane === 'analysis' ? ANALYSIS_BUNDLE_CONTRACT : DETAIL_BUNDLE_CONTRACT
}
