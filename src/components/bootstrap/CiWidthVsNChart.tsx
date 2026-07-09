import type { BootstrapCiSummary } from '@/fixtures/bootstrap'
import {
  bootstrapGroupKey,
  bootstrapGroupLabel,
  formatPassRate,
  type CiByN,
  type GroupObservation,
} from '@/lib/bootstrap-ci'

type CiWidthVsNChartProps = {
  /** One batch per ladder N, from computeCisAcrossN. */
  ciByN: CiByN[]
  observations: GroupObservation[]
  /** Reference "tight enough" CI width drawn on the width strip. */
  thresholdWidth?: number
}

export const DEFAULT_WIDTH_THRESHOLD = 0.1

/** Above this many series the interval fan falls back to small multiples. */
const MAX_OVERLAID_SERIES = 6

const SERIES_COLORS = [
  'var(--accent)',
  'var(--blue)',
  'var(--red)',
  'var(--yellow)',
  'var(--green)',
  'var(--syntax-keyword)',
] as const

const FAN_WIDTH = 640
const FAN_HEIGHT = 240
const STRIP_HEIGHT = 150
const MARGIN = { top: 10, right: 12, bottom: 22, left: 40 }
const FAN_Y_TICKS = [0, 0.25, 0.5, 0.75, 1] as const
const SERIES_X_OFFSET = 6

type SeriesPoint = {
  n: number
  summary: BootstrapCiSummary
  extrapolated: boolean
}

type Series = {
  key: string
  label: string
  color: string
  points: SeriesPoint[]
}

function buildSeries(ciByN: CiByN[], observations: GroupObservation[]): Series[] {
  const availableByKey = new Map(
    observations.map(observation => [
      bootstrapGroupKey(observation.model, observation.task_id),
      observation.n_available,
    ]),
  )
  const seriesByKey = new Map<string, Series>()
  for (const batch of ciByN) {
    for (const summary of batch.summaries) {
      const key = bootstrapGroupKey(summary.model, summary.task_id)
      let series = seriesByKey.get(key)
      if (series === undefined) {
        series = {
          key,
          label: bootstrapGroupLabel(summary.model, summary.task_id),
          color: SERIES_COLORS[seriesByKey.size % SERIES_COLORS.length],
          points: [],
        }
        seriesByKey.set(key, series)
      }
      const nAvailable = availableByKey.get(key)
      series.points.push({
        n: batch.n,
        summary,
        extrapolated: nAvailable !== undefined && batch.n > nAvailable,
      })
    }
  }
  return [...seriesByKey.values()]
}

function slotX(slotIndex: number, slotCount: number, width: number): number {
  const innerWidth = width - MARGIN.left - MARGIN.right
  return MARGIN.left + ((slotIndex + 0.5) / slotCount) * innerWidth
}

function valueY(value: number, maxValue: number, height: number): number {
  const innerHeight = height - MARGIN.top - MARGIN.bottom
  return MARGIN.top + (1 - value / maxValue) * innerHeight
}

type FanAxesProps = {
  ladder: readonly number[]
  width: number
  height: number
}

function FanAxes({ ladder, width, height }: FanAxesProps) {
  return (
    <>
      {FAN_Y_TICKS.map(tick => (
        <g key={tick}>
          <line
            x1={MARGIN.left}
            x2={width - MARGIN.right}
            y1={valueY(tick, 1, height)}
            y2={valueY(tick, 1, height)}
            stroke="var(--border-subtle)"
          />
          <text
            x={MARGIN.left - 6}
            y={valueY(tick, 1, height) + 3}
            textAnchor="end"
            className="fill-[var(--text-muted)] font-mono text-[9px]"
          >
            {tick}
          </text>
        </g>
      ))}
      {ladder.map((n, slotIndex) => (
        <text
          key={n}
          x={slotX(slotIndex, ladder.length, width)}
          y={height - MARGIN.bottom + 14}
          textAnchor="middle"
          className="fill-[var(--text-muted)] font-mono text-[9px]"
        >
          {n}
        </text>
      ))}
    </>
  )
}

type IntervalFanProps = {
  series: Series[]
  ladder: readonly number[]
  width: number
  height: number
  overlaid: boolean
  title: string
}

function IntervalFan({ series, ladder, width, height, overlaid, title }: IntervalFanProps) {
  return (
    <svg
      role="img"
      aria-label={title}
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
    >
      <FanAxes ladder={ladder} width={width} height={height} />
      {series.map((entry, seriesIndex) => {
        const offset = overlaid
          ? (seriesIndex - (series.length - 1) / 2) * SERIES_X_OFFSET
          : 0
        const observedPoints = entry.points
          .map(point => {
            const slotIndex = ladder.indexOf(point.n)
            const x = slotX(slotIndex, ladder.length, width) + offset
            return `${x},${valueY(point.summary.observed_pass_rate, 1, height)}`
          })
          .join(' ')
        return (
          <g key={entry.key}>
            <polyline
              points={observedPoints}
              fill="none"
              stroke={entry.color}
              strokeWidth={1}
              opacity={0.5}
            />
            {entry.points.map(point => {
              const slotIndex = ladder.indexOf(point.n)
              const x = slotX(slotIndex, ladder.length, width) + offset
              const ciWidth = point.summary.ci_high - point.summary.ci_low
              return (
                <g
                  key={point.n}
                  aria-label={`${entry.label} at N=${point.n}: CI ${formatPassRate(point.summary.ci_low)} to ${formatPassRate(point.summary.ci_high)} (width ${formatPassRate(ciWidth)})${point.extrapolated ? ' (extrapolated)' : ''}`}
                >
                  <line
                    data-ci-interval
                    data-series={entry.key}
                    data-n={point.n}
                    data-width={ciWidth.toFixed(4)}
                    data-extrapolated={point.extrapolated ? 'true' : undefined}
                    x1={x}
                    x2={x}
                    y1={valueY(point.summary.ci_high, 1, height)}
                    y2={valueY(point.summary.ci_low, 1, height)}
                    stroke={entry.color}
                    strokeWidth={2}
                    strokeDasharray={point.extrapolated ? '3 3' : undefined}
                  />
                  <circle
                    cx={x}
                    cy={valueY(point.summary.observed_pass_rate, 1, height)}
                    r={2.5}
                    fill={point.extrapolated ? 'var(--bg-primary)' : entry.color}
                    stroke={entry.color}
                  />
                </g>
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}

type WidthStripProps = {
  series: Series[]
  ladder: readonly number[]
  thresholdWidth: number
}

function WidthStrip({ series, ladder, thresholdWidth }: WidthStripProps) {
  const maxWidth = Math.max(
    thresholdWidth,
    ...series.flatMap(entry =>
      entry.points.map(point => point.summary.ci_high - point.summary.ci_low),
    ),
  )
  const yMax = maxWidth * 1.15
  return (
    <svg
      role="img"
      aria-label={`CI width vs N per group, with reference line at width ${thresholdWidth}`}
      viewBox={`0 0 ${FAN_WIDTH} ${STRIP_HEIGHT}`}
      className="w-full"
    >
      <line
        x1={MARGIN.left}
        x2={FAN_WIDTH - MARGIN.right}
        y1={valueY(0, yMax, STRIP_HEIGHT)}
        y2={valueY(0, yMax, STRIP_HEIGHT)}
        stroke="var(--border-subtle)"
      />
      <line
        data-width-threshold
        x1={MARGIN.left}
        x2={FAN_WIDTH - MARGIN.right}
        y1={valueY(thresholdWidth, yMax, STRIP_HEIGHT)}
        y2={valueY(thresholdWidth, yMax, STRIP_HEIGHT)}
        stroke="var(--red)"
        strokeDasharray="4 3"
      />
      <text
        x={FAN_WIDTH - MARGIN.right}
        y={valueY(thresholdWidth, yMax, STRIP_HEIGHT) - 4}
        textAnchor="end"
        className="fill-[var(--red)] font-mono text-[9px]"
      >
        width ≤ {thresholdWidth}
      </text>
      <text
        x={MARGIN.left - 6}
        y={valueY(0, yMax, STRIP_HEIGHT) + 3}
        textAnchor="end"
        className="fill-[var(--text-muted)] font-mono text-[9px]"
      >
        0
      </text>
      {ladder.map((n, slotIndex) => (
        <text
          key={n}
          x={slotX(slotIndex, ladder.length, FAN_WIDTH)}
          y={STRIP_HEIGHT - MARGIN.bottom + 14}
          textAnchor="middle"
          className="fill-[var(--text-muted)] font-mono text-[9px]"
        >
          {n}
        </text>
      ))}
      {series.map(entry => (
        <polyline
          key={entry.key}
          data-width-series={entry.key}
          points={entry.points
            .map(point => {
              const slotIndex = ladder.indexOf(point.n)
              const ciWidth = point.summary.ci_high - point.summary.ci_low
              return `${slotX(slotIndex, ladder.length, FAN_WIDTH)},${valueY(ciWidth, yMax, STRIP_HEIGHT)}`
            })
            .join(' ')}
          fill="none"
          stroke={entry.color}
          strokeWidth={1}
        />
      ))}
    </svg>
  )
}

/**
 * Compare-across-N view: interval fan (vertical CI per ladder N, connected
 * through the observed rate) plus a CI-width-vs-N strip with a decision
 * threshold. Ladder Ns beyond a group's available samples render dashed/hollow
 * and are labeled extrapolated.
 */
export function CiWidthVsNChart({
  ciByN,
  observations,
  thresholdWidth = DEFAULT_WIDTH_THRESHOLD,
}: CiWidthVsNChartProps) {
  const ladder = ciByN.map(batch => batch.n)
  const series = buildSeries(ciByN, observations)
  if (series.length === 0 || ladder.length === 0) return null
  const overlaid = series.length <= MAX_OVERLAID_SERIES

  return (
    <section>
      <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
        CI width vs N
      </h2>
      <p className="mt-1 mb-3 text-sm text-[var(--text-secondary)]">
        Each ladder N re-resamples the same observed rows with replicate draw
        size N (m-out-of-n), so intervals tighten ~1/√N. Dashed intervals are
        extrapolated beyond the available samples: they assume the observed
        rate is the truth, understating uncertainty about the rate itself.
      </p>
      <div className="space-y-4 rounded-xl border border-[var(--border)] p-4">
        {overlaid ? (
          <>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {series.map(entry => (
                <span
                  key={entry.key}
                  className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--text-secondary)]"
                >
                  <span
                    aria-hidden
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  {entry.label}
                </span>
              ))}
            </div>
            <IntervalFan
              series={series}
              ladder={ladder}
              width={FAN_WIDTH}
              height={FAN_HEIGHT}
              overlaid
              title={`Bootstrap CI fan across N for ${series.length} groups`}
            />
          </>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {series.map(entry => (
              <div key={entry.key}>
                <div
                  className="truncate font-mono text-[11px] text-[var(--text-secondary)]"
                  title={entry.label}
                >
                  {entry.label}
                </div>
                <IntervalFan
                  series={[entry]}
                  ladder={ladder}
                  width={320}
                  height={180}
                  overlaid={false}
                  title={`Bootstrap CI fan across N for ${entry.label}`}
                />
              </div>
            ))}
          </div>
        )}
        <div>
          <h3 className="mb-1 font-display text-[13px] font-semibold text-[var(--text-primary)]">
            Interval width by N
          </h3>
          <WidthStrip series={series} ladder={ladder} thresholdWidth={thresholdWidth} />
        </div>
      </div>
    </section>
  )
}
