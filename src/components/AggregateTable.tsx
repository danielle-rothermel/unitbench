'use client'

import { GenericTable } from '@/components/GenericTable'
import type { AggregateState } from '@/lib/aggregate-data'
import {
  aggregateHref,
  aggregateStateToTableState,
  tableStateToAggregateState,
} from '@/lib/aggregate-params'
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
    />
  )
}
