export const DEFAULT_PAGE = 1
export const DEFAULT_PAGE_SIZE = 25
export const MAX_PAGE_SIZE = 100

export type PaginationInput = {
  page?: string | string[] | undefined
  pageSize?: string | string[] | undefined
}

export type Pagination = {
  page: number
  pageSize: number
  offset: number
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function positiveInteger(value: string | string[] | undefined): number | null {
  const raw = firstValue(value)
  if (!raw) return null
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function parsePagination(input: PaginationInput): Pagination {
  const page = positiveInteger(input.page) ?? DEFAULT_PAGE
  const rawPageSize = positiveInteger(input.pageSize) ?? DEFAULT_PAGE_SIZE
  const pageSize = Math.min(rawPageSize, MAX_PAGE_SIZE)
  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  }
}

export function totalPages(total: number, pageSize: number): number {
  return total > 0 ? Math.ceil(total / pageSize) : 1
}
