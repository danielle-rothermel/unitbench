export type CodeStats = {
  lines: number
  chars: number
  bytes: number
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kib = bytes / 1024
  if (kib < 1024) return `${kib.toFixed(1)} KiB`
  return `${(kib / 1024).toFixed(1)} MiB`
}

export function codeStats(value: string): CodeStats {
  return {
    lines: value.split('\n').length,
    chars: value.length,
    bytes: new TextEncoder().encode(value).length,
  }
}

export function shortDate(value: string | Date | null | undefined): string {
  if (!value) return 'unknown'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const COST_FRACTION_DIGITS = 5

function formatCostAmount(value: number): string {
  return `$${value.toFixed(COST_FRACTION_DIGITS)}`
}

export function formatCost(cost: number | null | undefined): string | null {
  if (cost === null || cost === undefined) return null
  if (!Number.isFinite(cost)) return String(cost)
  return formatCostAmount(cost)
}

export function formatCostCell(value: unknown): string {
  if (value === null || value === undefined) return 'none'
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return String(value)
  return formatCostAmount(parsed)
}

export function formatNumber(value: unknown): string {
  if (value === null || value === undefined) return 'none'
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return String(value)
  if (Number.isInteger(parsed)) return parsed.toLocaleString()
  return parsed.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  })
}

export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return 'none'
  if (value instanceof Date) return shortDate(value)
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function prettyJson(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'object' && Object.keys(value).length === 0) return null
  return JSON.stringify(value, null, 2)
}
