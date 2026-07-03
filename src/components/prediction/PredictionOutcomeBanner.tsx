import { ErrorSection } from '@/components/panels/ErrorSection'
import type { OutcomeBanner } from '@/lib/prediction-diagnostics'

type PredictionOutcomeBannerProps = {
  banner: OutcomeBanner
}

export function PredictionOutcomeBanner({ banner }: PredictionOutcomeBannerProps) {
  return (
    <div className="mb-6 max-w-[1280px]">
      <ErrorSection
        tone={banner.tone}
        title={banner.title}
        message={banner.message}
      />
    </div>
  )
}
