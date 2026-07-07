import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CharCountFlow } from '@/components/compression/CharCountFlow'

function widthPercent(element: HTMLElement): number {
  return Number.parseFloat(element.style.width)
}

function leftPercent(element: HTMLElement): number {
  return Number.parseFloat(element.style.left)
}

describe('CharCountFlow', () => {
  it('sizes the three bars proportionally to the largest count', () => {
    render(
      <CharCountFlow
        ground_truth_char_count={200}
        encoded_char_count={100}
        generated_char_count={400}
        encoder_char_budget={120}
      />,
    )

    expect(widthPercent(screen.getByTestId('stage-bar-ground truth'))).toBe(50)
    expect(widthPercent(screen.getByTestId('stage-bar-encoded IR'))).toBe(25)
    expect(widthPercent(screen.getByTestId('stage-bar-generated'))).toBe(100)
  })

  it('shows counts with a chars suffix', () => {
    render(
      <CharCountFlow
        ground_truth_char_count={192}
        encoded_char_count={89}
        generated_char_count={205}
        encoder_char_budget={96}
      />,
    )

    expect(screen.getByText('192 chars')).toBeInTheDocument()
    expect(screen.getByText('89 chars')).toBeInTheDocument()
    expect(screen.getByText('205 chars')).toBeInTheDocument()
  })

  it('renders placeholders for null encoded and generated counts', () => {
    render(
      <CharCountFlow
        ground_truth_char_count={320}
        encoded_char_count={null}
        generated_char_count={null}
        encoder_char_budget={160}
      />,
    )

    expect(screen.getAllByText('not produced')).toHaveLength(2)
    expect(screen.getAllByText('—')).toHaveLength(2)
    expect(screen.getByTestId('stage-bar-ground truth')).toBeInTheDocument()
  })

  it('renders the budget tick only when the encoder budget is non-null', () => {
    const { rerender } = render(
      <CharCountFlow
        ground_truth_char_count={200}
        encoded_char_count={90}
        generated_char_count={210}
        encoder_char_budget={100}
      />,
    )
    expect(screen.getByTestId('budget-tick')).toBeInTheDocument()

    rerender(
      <CharCountFlow
        ground_truth_char_count={200}
        encoded_char_count={90}
        generated_char_count={210}
        encoder_char_budget={null}
      />,
    )
    expect(screen.queryByTestId('budget-tick')).not.toBeInTheDocument()
  })

  it('lets an over-budget encoded bar cross the budget tick', () => {
    render(
      <CharCountFlow
        ground_truth_char_count={200}
        encoded_char_count={105}
        generated_char_count={190}
        encoder_char_budget={100}
      />,
    )

    const encodedWidth = widthPercent(screen.getByTestId('stage-bar-encoded IR'))
    const tickLeft = leftPercent(screen.getByTestId('budget-tick'))
    expect(encodedWidth).toBeGreaterThan(tickLeft)
  })

  it('notes when the generated output exceeds the ground truth', () => {
    render(
      <CharCountFlow
        ground_truth_char_count={192}
        encoded_char_count={89}
        generated_char_count={205}
        encoder_char_budget={96}
      />,
    )

    expect(
      screen.getByText('exceeds ground truth (normal for reconstruction)'),
    ).toBeInTheDocument()
  })
})
