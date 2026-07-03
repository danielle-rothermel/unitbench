'use client'

import { HideTestExperimentsToggle } from '@/components/HideTestExperimentsToggle'
import { tableHref, type TableState } from '@/lib/table-params'

type TableHideTestExperimentsToggleProps = {
  tableId: string
  state: TableState
}

export function TableHideTestExperimentsToggle({
  tableId,
  state,
}: TableHideTestExperimentsToggleProps) {
  return (
    <HideTestExperimentsToggle
      hideTestExperiments={state.hideTestExperiments}
      current={state}
      buildHref={next => tableHref(tableId, next)}
      applyToggle={(current, hide) => ({
        ...current,
        page: 1,
        hideTestExperiments: hide,
      })}
    />
  )
}
