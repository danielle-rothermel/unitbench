import { expect, test } from '@playwright/test'

test('sidebar exposes the lane IA and existing pages stay reachable', async ({
  page,
}) => {
  await page.goto('/')
  const nav = page.locator('nav')
  for (const lane of ['Data', 'Replay', 'Playgrounds', 'Design', 'Lab']) {
    await expect(nav.getByText(lane, { exact: true })).toBeVisible()
  }

  await nav.getByRole('link', { name: 'Heatmap' }).click()
  await expect(page).toHaveURL(/\/aggregate\/heatmap/)
  await expect(page.getByRole('grid')).toBeVisible()

  await nav.getByRole('link', { name: 'Published experiments' }).click()
  await expect(page).toHaveURL(/\/tables\/published-experiments/)

  await nav.getByRole('link', { name: 'Experiments', exact: true }).click()
  await expect(page).toHaveURL(/\/lab$/)
})

test('lab chart demo renders the token-themed scatter', async ({ page }) => {
  await page.goto('/lab/chart-demo')

  const scatter = page.getByTestId('demo-scatter')
  await expect(scatter).toBeVisible()
  expect(await scatter.locator('circle').count()).toBeGreaterThanOrEqual(9)

  const fill = await scatter.locator('circle').first().getAttribute('fill')
  expect(fill).toContain('var(--')
})
