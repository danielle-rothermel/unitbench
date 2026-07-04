'use client'

import { useEffect, type RefObject } from 'react'

export const FILTER_SHORTCUT_ATTR = 'data-shortcut-filter'

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  )
}

function focusFilterInput(): boolean {
  const input = document.querySelector<HTMLInputElement>(
    `[${FILTER_SHORTCUT_ATTR}]`,
  )
  if (!input) return false
  input.focus()
  input.select()
  return true
}

function moveRowFocus(
  container: HTMLElement,
  direction: 1 | -1,
): void {
  const rows = [
    ...container.querySelectorAll<HTMLTableRowElement>('tbody tr[data-row]'),
  ]
  if (rows.length === 0) return
  const activeIndex = rows.findIndex(row =>
    row.contains(document.activeElement),
  )
  const nextIndex = Math.min(
    Math.max(activeIndex + direction, 0),
    rows.length - 1,
  )
  const row = rows[nextIndex]
  const target = row.querySelector<HTMLElement>('a, button') ?? row
  target.focus()
  row.scrollIntoView({ block: 'nearest' })
}

/**
 * Table-page keyboard shortcuts: `/` focuses the first filter input
 * (marked with data-shortcut-filter), `j`/`k` move focus down/up the
 * table rows. Ignored while typing in a form control.
 */
export function useTableShortcuts(
  containerRef: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingTarget(event.target)) return

      if (event.key === '/') {
        if (focusFilterInput()) event.preventDefault()
        return
      }

      if (event.key === 'j' || event.key === 'k') {
        const container = containerRef.current
        if (!container) return
        event.preventDefault()
        moveRowFocus(container, event.key === 'j' ? 1 : -1)
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [containerRef])
}
