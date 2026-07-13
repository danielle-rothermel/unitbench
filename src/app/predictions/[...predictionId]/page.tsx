import { notFound } from 'next/navigation'
import { BundleState } from '@/components/panels/BundleState'
import { PredictionDetailPage } from '@/components/PredictionDetailPage'
import { getPredictionDetail } from '@/lib/prediction-detail'
import {
  DEFAULT_PREDICTIONS_TABLE_ID,
  getTableConfig,
  UnknownTableError,
} from '@/lib/table-config'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ predictionId: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function tableIdFrom(searchParams: Record<string, string | string[] | undefined>): string {
  const raw = searchParams.table
  const value = Array.isArray(raw) ? raw[0] : raw
  return value || DEFAULT_PREDICTIONS_TABLE_ID
}

function backHrefFrom(
  tableId: string,
  returnParam: string | string[] | undefined,
): string {
  const raw = Array.isArray(returnParam) ? returnParam[0] : returnParam
  const base = `/tables/${tableId}`
  return raw ? `${base}?${raw}` : base
}

export function predictionIdFromSegments(predictionId: readonly string[]): string | null {
  if (predictionId.length === 0 || predictionId.some(segment => !segment)) return null
  return predictionId.map(decodeURIComponent).join('/')
}

export default async function Page({ params, searchParams }: PageProps) {
  const [{ predictionId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ])
  const id = predictionIdFromSegments(predictionId)
  if (!id) notFound()
  const tableId = tableIdFrom(resolvedSearchParams)

  try {
    getTableConfig(tableId)
  } catch (error) {
    if (!(error instanceof UnknownTableError)) throw error
  }

  const result = await getPredictionDetail(id)

  if (result.status === 'not-found') notFound()

  const backHref = backHrefFrom(tableId, resolvedSearchParams.return)

  if (result.status === 'failure') return <BundleState plane="Detail" failure={result.failure} />

  return <PredictionDetailPage detail={result.detail} provenance={result.provenance} bundle={result.bundle} backHref={backHref} />
}
