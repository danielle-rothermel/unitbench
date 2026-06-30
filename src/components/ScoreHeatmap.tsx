import { cn } from '@/lib/cn'
import type { TableRow } from '@/lib/table-data'

type ScoreHeatmapProps = {
  rows: TableRow[]
}

type HeatmapCell = {
  avgScore: number | null
  n: number
}

function formatScore(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '—'
  return value.toFixed(3)
}

function scoreColor(value: number | null, min: number, max: number): string {
  if (value === null || Number.isNaN(value)) {
    return 'var(--bg-secondary)'
  }
  if (max <= min) {
    return 'rgb(220, 38, 38)'
  }
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)))
  const red = Math.round(220 - t * 150)
  const green = Math.round(40 + t * 140)
  const blue = Math.round(38 + t * 60)
  return `rgb(${red}, ${green}, ${blue})`
}

function pivotRows(rows: TableRow[]): {
  models: string[]
  kinds: string[]
  cells: Map<string, Map<string, HeatmapCell>>
} {
  const kindSet = new Set<string>()
  const cellMap = new Map<string, Map<string, HeatmapCell>>()

  for (const row of rows) {
    const model = String(row.model ?? '')
    const kind = String(row.experiment_kind ?? '')
    if (!model || !kind) continue
    kindSet.add(kind)
    const avgRaw = row.avg_score
    const avgScore =
      typeof avgRaw === 'number'
        ? avgRaw
        : avgRaw === null || avgRaw === undefined
          ? null
          : Number(avgRaw)
    const nRaw = row.n
    const n =
      typeof nRaw === 'number'
        ? nRaw
        : Number.parseInt(String(nRaw ?? '0'), 10) || 0
    if (!cellMap.has(model)) cellMap.set(model, new Map())
    cellMap.get(model)?.set(kind, { avgScore, n })
  }

  const kinds = [...kindSet].sort()
  const models = [...cellMap.keys()].sort((left, right) => {
    const leftScores = kinds
      .map(kind => cellMap.get(left)?.get(kind)?.avgScore)
      .filter((value): value is number => value !== null && !Number.isNaN(value))
    const rightScores = kinds
      .map(kind => cellMap.get(right)?.get(kind)?.avgScore)
      .filter((value): value is number => value !== null && !Number.isNaN(value))
    const leftMin = leftScores.length > 0 ? Math.min(...leftScores) : Number.POSITIVE_INFINITY
    const rightMin = rightScores.length > 0 ? Math.min(...rightScores) : Number.POSITIVE_INFINITY
    if (leftMin !== rightMin) return leftMin - rightMin
    return left.localeCompare(right)
  })

  return { models, kinds, cells: cellMap }
}

export function ScoreHeatmap({ rows }: ScoreHeatmapProps) {
  const { models, kinds, cells } = pivotRows(rows)
  if (models.length === 0 || kinds.length === 0) {
    return (
      <div className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
        No heatmap data for the current filters.
      </div>
    )
  }

  const scores = models.flatMap(model =>
    kinds
      .map(kind => cells.get(model)?.get(kind)?.avgScore)
      .filter((value): value is number => value !== null && !Number.isNaN(value)),
  )
  const min = scores.length > 0 ? Math.min(...scores) : 0
  const max = scores.length > 0 ? Math.max(...scores) : 1

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
            Model × experiment kind
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Average score by model and experiment kind. Lower scores appear more red.
          </p>
        </div>
        <div className="hidden items-center gap-2 text-[11px] text-[var(--text-muted)] sm:flex">
          <span>{formatScore(min)}</span>
          <div
            className="h-3 w-24 rounded-sm border border-[var(--border)]"
            style={{
              background:
                'linear-gradient(to right, rgb(220, 38, 38), rgb(70, 180, 98))',
            }}
          />
          <span>{formatScore(max)}</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <div
          className="grid min-w-max gap-px bg-[var(--border)] p-px"
          style={{
            gridTemplateColumns: `minmax(220px, 1.4fr) repeat(${kinds.length}, minmax(120px, 1fr))`,
          }}
        >
          <div className="bg-[var(--bg-secondary)] px-3 py-2 font-display text-[11px] font-semibold tracking-[0.06em] text-[var(--text-muted)] uppercase">
            Model
          </div>
          {kinds.map(kind => (
            <div
              key={kind}
              className="bg-[var(--bg-secondary)] px-3 py-2 font-display text-[11px] font-semibold tracking-[0.06em] text-[var(--text-muted)] uppercase"
            >
              {kind}
            </div>
          ))}

          {models.map(model => (
            <div key={model} className="contents">
              <div
                className="bg-[var(--bg-primary)] px-3 py-2 font-mono text-[12px] text-[var(--text-secondary)]"
                title={model}
              >
                <span className="block truncate">{model}</span>
              </div>
              {kinds.map(kind => {
                const cell = cells.get(model)?.get(kind)
                const avgScore = cell?.avgScore ?? null
                const background = scoreColor(avgScore, min, max)
                const textClass =
                  avgScore !== null && avgScore < (min + max) / 2
                    ? 'text-white'
                    : 'text-[var(--text-primary)]'
                return (
                  <div
                    key={`${model}-${kind}`}
                    className={cn(
                      'px-3 py-2 text-right font-mono text-[12px]',
                      textClass,
                    )}
                    style={{ backgroundColor: background }}
                    title={
                      cell
                        ? `avg_score=${formatScore(avgScore)}, n=${cell.n}`
                        : 'No data'
                    }
                  >
                    {formatScore(avgScore)}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
