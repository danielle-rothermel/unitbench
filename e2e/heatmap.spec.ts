import { expect, test } from '@playwright/test'

test.describe('aggregate heatmap', () => {
  test('renders an accessible grid with no console errors', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })

    await page.goto('/aggregate/heatmap')

    const grid = page.getByRole('grid')
    await expect(grid).toBeVisible()
    expect(await grid.getByRole('columnheader').count()).toBeGreaterThan(1)
    expect(await grid.getByRole('rowheader').count()).toBeGreaterThan(0)

    const firstCellLink = grid.getByRole('gridcell').first().getByRole('link')
    await expect(firstCellLink).toHaveAccessibleName(/^.+, .+: .+$/)

    // Give hydration a beat to surface any mismatch errors.
    await page.waitForLoadState('networkidle')
    expect(consoleErrors).toEqual([])
  })

  test('keeps cell text contrast at 4.5:1 or better', async ({ page }) => {
    await page.goto('/aggregate/heatmap')
    await expect(page.getByRole('grid')).toBeVisible()

    const worstContrast = await page.evaluate(() => {
      const parseRgb = (css: string): [number, number, number] | null => {
        const match = css.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
        if (!match) return null
        return [Number(match[1]), Number(match[2]), Number(match[3])]
      }
      const luminance = ([r, g, b]: [number, number, number]): number => {
        const linear = (value: number) => {
          const scaled = value / 255
          return scaled <= 0.04045
            ? scaled / 12.92
            : Math.pow((scaled + 0.055) / 1.055, 2.4)
        }
        return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
      }

      let worst = Infinity
      const cells = document.querySelectorAll('[role="gridcell"]')
      for (const cell of cells) {
        const link = cell.querySelector('a')
        if (!link || link.textContent?.trim() === '—') continue
        const background = parseRgb(getComputedStyle(cell).backgroundColor)
        const text = parseRgb(getComputedStyle(link).color)
        if (!background || !text) continue
        const lBackground = luminance(background)
        const lText = luminance(text)
        const ratio =
          (Math.max(lBackground, lText) + 0.05) /
          (Math.min(lBackground, lText) + 0.05)
        if (ratio < worst) worst = ratio
      }
      return worst
    })

    expect(worstContrast).toBeGreaterThanOrEqual(4.5)
  })
})
