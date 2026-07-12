'use client'

import { AxisBottom, AxisLeft } from '@visx/axis'
import { GridRows } from '@visx/grid'
import { Group } from '@visx/group'
import { scaleBand, scaleLinear } from '@visx/scale'
import Link from 'next/link'
import { SECTION_LABEL, Tag } from '@/components/primitives'
import {
  CHART_AXIS_LABEL_PROPS,
  CHART_TICK_LABEL_PROPS,
} from '@/lib/chart-theme'
import {
  DISTRIBUTION_BUCKETS,
  DISTRIBUTION_MAX_RATIO,
  type CompressionDistributionBin,
  type CorrectnessCompressionPoint,
} from '@/lib/dashboard-model'

const SCATTER_WIDTH = 960
const SCATTER_HEIGHT = 380
const HIST_HEIGHT = 300
const MARGIN = { top: 16, right: 24, bottom: 48, left: 56 }
const MAX_RATIO = DISTRIBUTION_MAX_RATIO
const JITTER_SPREAD = 0.34

const STATE_COLOR: Record<string, string> = {
  passed: 'var(--green)',
  failed: 'var(--red)',
}

// Deterministic per-prediction jitter so the binary score bands read
// as densities without breaking reproducible renders.
function jitterOffset(predictionId: string): number {
  let hash = 0
  for (let index = 0; index < predictionId.length; index += 1) {
    hash = (hash * 31 + predictionId.charCodeAt(index)) | 0
  }
  const unit = ((hash >>> 0) % 1000) / 1000
  return (unit - 0.5) * JITTER_SPREAD
}

function predictionHref(predictionId: string): string {
  return `/predictions/${predictionId.split('/').map(encodeURIComponent).join('/')}`
}

function CorrectnessScatter({
  points,
}: {
  points: CorrectnessCompressionPoint[]
}) {
  const innerWidth = SCATTER_WIDTH - MARGIN.left - MARGIN.right
  const innerHeight = SCATTER_HEIGHT - MARGIN.top - MARGIN.bottom

  const visible = points.filter(
    point =>
      point.compressionRatio !== null &&
      point.compressionRatio <= MAX_RATIO &&
      point.score !== null,
  )
  const omitted = points.length - visible.length

  const xScale = scaleLinear<number>({
    domain: [0, MAX_RATIO],
    range: [0, innerWidth],
  })
  const yScale = scaleLinear<number>({
    domain: [-0.3, 1.3],
    range: [innerHeight, 0],
  })

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={SECTION_LABEL}>
          Correctness vs compression (per prediction)
        </span>
        <Tag mono>{visible.length} points</Tag>
        {omitted > 0 && (
          <Tag tone="yellow" mono>
            {omitted} beyond ratio {MAX_RATIO} not shown
          </Tag>
        )}
      </div>
      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
        <svg
          width={SCATTER_WIDTH}
          height={SCATTER_HEIGHT}
          role="img"
          aria-label="Scatter of prediction score vs compression ratio"
          data-testid="dashboard-scatter"
        >
          <Group left={MARGIN.left} top={MARGIN.top}>
            <GridRows
              scale={yScale}
              width={innerWidth}
              stroke="var(--border-subtle)"
              tickValues={[0, 1]}
            />
            {visible.map(point => (
              <Link
                key={point.predictionId}
                href={predictionHref(point.predictionId)}
              >
                <circle
                  data-testid="dashboard-point"
                  cx={xScale(point.compressionRatio ?? 0)}
                  cy={yScale(
                    (point.score ?? 0) + jitterOffset(point.predictionId),
                  )}
                  r={3}
                  fill={STATE_COLOR[point.resultState] ?? 'var(--accent)'}
                  fillOpacity={0.45}
                >
                  <title>{`${point.predictionId} — ${point.resultState}, ratio ${point.compressionRatio?.toFixed(2)}`}</title>
                </circle>
              </Link>
            ))}
            <AxisLeft
              scale={yScale}
              stroke="var(--border-strong)"
              tickStroke="var(--border-strong)"
              tickValues={[0, 1]}
              tickFormat={value => (Number(value) === 1 ? 'passed' : 'failed')}
              label="score"
              labelProps={CHART_AXIS_LABEL_PROPS}
              tickLabelProps={() => ({
                ...CHART_TICK_LABEL_PROPS,
                textAnchor: 'end' as const,
                dx: -4,
                dy: 3,
              })}
            />
            <AxisBottom
              top={innerHeight}
              scale={xScale}
              stroke="var(--border-strong)"
              tickStroke="var(--border-strong)"
              label="best compression ratio (vs ground truth)"
              labelProps={CHART_AXIS_LABEL_PROPS}
              tickLabelProps={() => ({
                ...CHART_TICK_LABEL_PROPS,
                textAnchor: 'middle' as const,
                dy: 4,
              })}
            />
          </Group>
        </svg>
      </div>
    </section>
  )
}

function CompressionHistogram({
  distribution,
}: {
  distribution: CompressionDistributionBin[]
}) {
  const innerWidth = SCATTER_WIDTH - MARGIN.left - MARGIN.right
  const innerHeight = HIST_HEIGHT - MARGIN.top - MARGIN.bottom
  const bucketWidth = MAX_RATIO / DISTRIBUTION_BUCKETS

  // width_bucket: 1..BUCKETS in range, BUCKETS+1 overflow.
  const buckets = Array.from(
    { length: DISTRIBUTION_BUCKETS + 1 },
    (_, index) => index + 1,
  )
  const countFor = (bucket: number, state: string): number =>
    distribution
      .filter(bin => bin.bucket === bucket && bin.resultState === state)
      .reduce((total, bin) => total + bin.count, 0)

  const bucketLabel = (bucket: number): string =>
    bucket > DISTRIBUTION_BUCKETS
      ? `>${MAX_RATIO}`
      : `${((bucket - 1) * bucketWidth).toFixed(2)}`

  const maxCount = Math.max(
    1,
    ...buckets.flatMap(bucket => [
      countFor(bucket, 'passed'),
      countFor(bucket, 'failed'),
    ]),
  )

  const xScale = scaleBand<number>({
    domain: buckets,
    range: [0, innerWidth],
    padding: 0.25,
  })
  const yScale = scaleLinear<number>({
    domain: [0, maxCount],
    range: [innerHeight, 0],
    nice: true,
  })
  const halfBand = (xScale.bandwidth() ?? 0) / 2

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={SECTION_LABEL}>
          Compression ratio distribution (all qualifying predictions)
        </span>
        <Tag tone="green">passed</Tag>
        <Tag tone="red">failed</Tag>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
        <svg
          width={SCATTER_WIDTH}
          height={HIST_HEIGHT}
          role="img"
          aria-label="Histogram of compression ratio by outcome"
          data-testid="dashboard-histogram"
        >
          <Group left={MARGIN.left} top={MARGIN.top}>
            <GridRows
              scale={yScale}
              width={innerWidth}
              stroke="var(--border-subtle)"
              numTicks={4}
            />
            {buckets.map(bucket => {
              const x = xScale(bucket) ?? 0
              return (
                <Group key={bucket}>
                  {(['passed', 'failed'] as const).map((state, index) => {
                    const count = countFor(bucket, state)
                    const barHeight = innerHeight - yScale(count)
                    return (
                      <rect
                        key={state}
                        data-testid="dashboard-bar"
                        x={x + index * halfBand}
                        y={yScale(count)}
                        width={halfBand}
                        height={barHeight}
                        fill={STATE_COLOR[state]}
                        fillOpacity={0.65}
                      >
                        <title>{`${state}: ${count} in bucket ${bucketLabel(bucket)}`}</title>
                      </rect>
                    )
                  })}
                </Group>
              )
            })}
            <AxisLeft
              scale={yScale}
              numTicks={4}
              stroke="var(--border-strong)"
              tickStroke="var(--border-strong)"
              label="predictions"
              labelProps={CHART_AXIS_LABEL_PROPS}
              tickLabelProps={() => ({
                ...CHART_TICK_LABEL_PROPS,
                textAnchor: 'end' as const,
                dx: -4,
                dy: 3,
              })}
            />
            <AxisBottom
              top={innerHeight}
              scale={xScale}
              stroke="var(--border-strong)"
              tickStroke="var(--border-strong)"
              tickFormat={bucketLabel}
              label="best compression ratio bucket (lower bound)"
              labelProps={CHART_AXIS_LABEL_PROPS}
              tickLabelProps={() => ({
                ...CHART_TICK_LABEL_PROPS,
                textAnchor: 'middle' as const,
                dy: 4,
                fontSize: 9,
              })}
            />
          </Group>
        </svg>
      </div>
    </section>
  )
}

export function DashboardCharts({
  points,
  distribution,
}: {
  points: CorrectnessCompressionPoint[]
  distribution: CompressionDistributionBin[]
}) {
  return (
    <div className="flex flex-col gap-8">
      <CorrectnessScatter points={points} />
      <CompressionHistogram distribution={distribution} />
    </div>
  )
}
