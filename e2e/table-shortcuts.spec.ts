import { expect, test } from '@playwright/test'

test('/ focuses the table filter and j/k move row focus', async ({ page }) => {
  await page.goto('/tables/published-predictions')
  await expect(page.locator('tbody tr[data-row]').first()).toBeVisible()

  // The shortcut listener attaches after hydration; retry the press
  // until it lands rather than assuming hydration finished.
  await expect(async () => {
    await page.keyboard.press('/')
    await expect(page.locator('[data-shortcut-filter]')).toBeFocused({
      timeout: 500,
    })
  }).toPass({ timeout: 15_000 })

  // Typing inside the filter must not trigger row navigation.
  await page.keyboard.type('j')
  await expect(page.locator('[data-shortcut-filter]')).toHaveValue('j')
  await page.locator('[data-shortcut-filter]').clear()

  await page.evaluate(() => {
    const active = document.activeElement
    if (active instanceof HTMLElement) active.blur()
  })

  const rowFocusTarget = (index: number) =>
    page.locator('tbody tr[data-row]').nth(index).locator('a, button').first()

  await page.keyboard.press('j')
  await expect(rowFocusTarget(0)).toBeFocused()

  await page.keyboard.press('j')
  await expect(rowFocusTarget(1)).toBeFocused()

  await page.keyboard.press('k')
  await expect(rowFocusTarget(0)).toBeFocused()
})
