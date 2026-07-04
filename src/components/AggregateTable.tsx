'use client'

import { GenericTable } from '@/components/GenericTable'
import { isGroupByColumn } from '@/lib/aggregate-config'
import type { AggregateState } from '@/lib/aggregate-data'
import {
  aggregateHref,
  aggregateStateToTableState,
  tableStateToAggregateState,
} from '@/lib/aggregate-params'
import { aggregateRowPredictionsHref } from '@/lib/predictions-nav'
import type { TableRow } from '@/lib/table-data'
import type { TableConfig } from '@/lib/table-config'

type AggregateTableProps = {
  aggregateState: AggregateState
  tableConfig: TableConfig
  rows: TableRow[]
  total: number
  totalPages: number
}

export function AggregateTable({
  aggregateState,
  tableConfig,
  rows,
  total,
  totalPages,
}: AggregateTableProps) {
  const tableState = aggregateStateToTableState(aggregateState)
  const groupBy = new Set(aggregateState.groupBy.filter(isGroupByColumn))

  return (
    <GenericTable
      config={tableConfig}
      state={tableState}
      rows={rows}
      total={total}
      totalPages={totalPages}
      hrefBuilder={next =>
        aggregateHref(tableStateToAggregateState(aggregateState, next))
      }
      getCellHref={(row, columnKey) =>
        isGroupByColumn(columnKey) && groupBy.has(columnKey)
          ? aggregateRowPredictionsHref(aggregateState, row)
          : null
      }
    />
  )
}
