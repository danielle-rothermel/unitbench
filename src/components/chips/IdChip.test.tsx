import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { IdChip } from '@/components/chips/IdChip'

describe('IdChip', () => {
  it('uses controlled copy feedback when copied matches the value', () => {
    const onCopy = vi.fn()
    render(
      <IdChip
        label="Prediction"
        value="pred-1"
        copied="pred-1"
        onCopy={onCopy}
      />,
    )

    const button = screen.getByRole('button', {
      name: 'Prediction: copied',
    })
    fireEvent.click(button)

    expect(onCopy).toHaveBeenCalledWith('pred-1')
  })

  it('renders display text while copying the raw value', () => {
    const onCopy = vi.fn()
    render(
      <IdChip
        label="Updated"
        value="2026-06-28T12:05:00Z"
        display="Jun 28"
        onCopy={onCopy}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Updated: Jun 28' }))

    expect(onCopy).toHaveBeenCalledWith('2026-06-28T12:05:00Z')
  })
})
