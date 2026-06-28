import { notFound } from 'next/navigation'
import { ErrorSection } from '@/components/panels/ErrorSection'
import { PredictionDetailPage } from '@/components/PredictionDetailPage'
import { getPredictionDetail } from '@/lib/prediction-detail'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ predictionId: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const PREDICTIONS_TABLE_PATH = '/tables/published-predictions'

function backHrefFrom(returnParam: string | string[] | undefined): string {
  const raw = Array.isArray(returnParam) ? returnParam[0] : returnParam
  return raw ? `${PREDICTIONS_TABLE_PATH}?${raw}` : PREDICTIONS_TABLE_PATH
}

export default async function Page({ params, searchParams }: PageProps) {
  const [{ predictionId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ])
  const id = predictionId.map(decodeURIComponent).join('/')
  const result = await getPredictionDetail(id)

  if (result.status === 'not-found') notFound()

  const backHref = backHrefFrom(resolvedSearchParams.return)

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
