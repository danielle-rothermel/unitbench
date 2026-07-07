import type { Metadata } from 'next'
import { ExtractionFlowDemo } from '@/components/extraction-flow/ExtractionFlowDemo'

export const metadata: Metadata = {
  title: 'Extraction flow · dev',
  description:
    'Dev-only visualizer of the code → extraction → tests flow against fixture data.',
}

export default function Page() {
  return <ExtractionFlowDemo />
}
