import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  parsePagination,
  totalPages,
} from '@/lib/pagination'

describe('parsePagination', () => {
  it('uses defaults for missing values', () => {
    expect(parsePagination({})).toEqual({
      page: DEFAULT_PAGE,
      pageSize: DEFAULT_PAGE_SIZE,
      offset: 0,
    })
  })

  it('clamps page size to the maximum', () => {
    expect(parsePagination({ page: '3', pageSize: '999' })).toEqual({
      page: 3,
      pageSize: MAX_PAGE_SIZE,
      offset: 200,
    })
  })

  it('ignores invalid values', () => {
    expect(parsePagination({ page: '-1', pageSize: 'wat' })).toEqual({
      page: DEFAULT_PAGE,
      pageSize: DEFAULT_PAGE_SIZE,
      offset: 0,
    })
  })
})

describe('totalPages', () => {
  it('keeps empty tables on a single page', () => {
    expect(totalPages(0, 25)).toBe(1)
  })

  it('rounds partial pages up', () => {
    expect(totalPages(51, 25)).toBe(3)
  })
})
