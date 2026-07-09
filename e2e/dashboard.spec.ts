import { expect, test } from '@playwright/test'

test.describe('dashboard', () => {
  test('renders both charts from live data', async ({ page }) => {
    await page.goto('/dashboard')

    await expect(page.getByTestId('dashboard-scatter')).toBeVisible()
    expect(
      await page.getByTestId('dashboard-point').count(),
    ).toBeGreaterThan(10)

    await expect(page.getByTestId('dashboard-histogram')).toBeVisible()
    expect(await page.getByTestId('dashboard-bar').count()).toBeGreaterThan(4)
  })

  test('every scatter point links to its prediction detail', async ({
    page,
  }) => {
    await page.goto('/dashboard')
    await expect(page.getByTestId('dashboard-scatter')).toBeVisible()

    const pointLinks = page.locator(
      '[data-testid="dashboard-scatter"] a[href^="/predictions/"]',
    )
    const linkCount = await pointLinks.count()
    const pointCount = await page.getByTestId('dashboard-point').count()
    expect(linkCount).toBe(pointCount)

    await pointLinks.first().click({ force: true })
    await expect(page).toHaveURL(/\/predictions\//)
    await expect(page.getByText('Debug payloads')).toBeVisible()
  })
})
