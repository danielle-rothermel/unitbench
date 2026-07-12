import { notFound } from 'next/navigation'
import { ErrorSection } from '@/components/panels/ErrorSection'
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

export default async function Page({ params, searchParams }: PageProps) {
  const [{ predictionId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ])
  const id = predictionId.map(decodeURIComponent).join('/')
  const tableId = tableIdFrom(resolvedSearchParams)

  try {
    getTableConfig(tableId)
  } catch (error) {
    if (!(error instanceof UnknownTableError)) throw error
  }

  const result = await getPredictionDetail(id)

  if (result.status === 'not-found') notFound()

  const backHref = backHrefFrom(tableId, resolvedSearchParams.return)

  if (result.status === 'missing-url') {
    return (
      <ErrorSection
        tone="setup"
        title="DATABASE_URL not configured"
        message="Set DATABASE_URL locally or in Vercel before reading this Neon table."
      />
    )
  }

  if (result.status === 'error') {
    return (
      <ErrorSection
        title="Failed to load prediction"
        message={result.message}
      />
    )
  }

  return <PredictionDetailPage detail={result.detail} backHref={backHref} />
}
