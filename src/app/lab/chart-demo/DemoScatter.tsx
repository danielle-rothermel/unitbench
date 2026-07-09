'use client'

import { AxisBottom, AxisLeft } from '@visx/axis'
import { GridColumns, GridRows } from '@visx/grid'
import { Group } from '@visx/group'
import { scaleLinear } from '@visx/scale'
import {
  CHART_AXIS_LABEL_PROPS,
  CHART_THEME,
  CHART_TICK_LABEL_PROPS,
} from '@/lib/chart-theme'

type DemoPoint = {
  model: string
  compressionRatio: number
  passRate: number
  seriesIndex: number
}

const DEMO_POINTS: DemoPoint[] = [
  { model: 'gpt-5-nano', compressionRatio: 0.18, passRate: 0.74, seriesIndex: 0 },
  { model: 'gpt-5-nano', compressionRatio: 0.32, passRate: 0.65, seriesIndex: 0 },
  { model: 'gpt-5-nano', compressionRatio: 0.51, passRate: 0.48, seriesIndex: 0 },
  { model: 'gpt-5.4-nano', compressionRatio: 0.2, passRate: 0.82, seriesIndex: 1 },
  { model: 'gpt-5.4-nano', compressionRatio: 0.35, passRate: 0.71, seriesIndex: 1 },
  { model: 'gpt-5.4-nano', compressionRatio: 0.55, passRate: 0.6, seriesIndex: 1 },
  { model: 'gemini-flash', compressionRatio: 0.15, passRate: 0.69, seriesIndex: 2 },
  { model: 'gemini-flash', compressionRatio: 0.4, passRate: 0.52, seriesIndex: 2 },
  { model: 'gemini-flash', compressionRatio: 0.6, passRate: 0.38, seriesIndex: 2 },
]

const WIDTH = 640
const HEIGHT = 400
const MARGIN = { top: 16, right: 24, bottom: 48, left: 56 }

export function DemoScatter() {
  const innerWidth = WIDTH - MARGIN.left - MARGIN.right
  const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom

  const xScale = scaleLinear<number>({
    domain: [0, 0.7],
    range: [0, innerWidth],
    nice: true,
  })
  const yScale = scaleLinear<number>({
    domain: [0, 1],
    range: [innerHeight, 0],
    nice: true,
  })

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
      <svg
        width={WIDTH}
        height={HEIGHT}
        role="img"
        aria-label="Demo scatter: pass rate vs compression ratio by model"
        data-testid="demo-scatter"
      >
        <Group left={MARGIN.left} top={MARGIN.top}>
          <GridRows
            scale={yScale}
            width={innerWidth}
            stroke={CHART_THEME.grid.stroke}
          />
          <GridColumns
            scale={xScale}
            height={innerHeight}
            stroke={CHART_THEME.grid.stroke}
          />
          {DEMO_POINTS.map(point => (
            <circle
              key={`${point.model}-${point.compressionRatio}`}
              cx={xScale(point.compressionRatio)}
              cy={yScale(point.passRate)}
              r={CHART_THEME.point.radius}
              fill={CHART_THEME.series[point.seriesIndex]}
              fillOpacity={CHART_THEME.point.fillOpacity}
              stroke={CHART_THEME.point.stroke}
            >
              <title>{`${point.model}: compression ${point.compressionRatio}, pass rate ${point.passRate}`}</title>
            </circle>
          ))}
          <AxisLeft
            scale={yScale}
            stroke={CHART_THEME.axis.stroke}
            tickStroke={CHART_THEME.axis.tickStroke}
            label="pass rate"
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
            stroke={CHART_THEME.axis.stroke}
            tickStroke={CHART_THEME.axis.tickStroke}
            label="compression ratio"
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
  )
}
