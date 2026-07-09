import { expect, test } from '@playwright/test'

test('prediction detail collapses debug payloads by default', async ({
  page,
}) => {
  await page.goto('/tables/published-predictions')
  const detailLink = page.locator('a[href^="/predictions/"]').first()
  await expect(detailLink).toBeVisible()
  await detailLink.click()

  await expect(page.getByText('Debug payloads')).toBeVisible()

  const payloadPanes = page.locator('details')
  const paneCount = await payloadPanes.count()
  expect(paneCount).toBeGreaterThan(0)
  for (let index = 0; index < paneCount; index += 1) {
    expect(
      await payloadPanes
        .nth(index)
        .evaluate(element => (element as HTMLDetailsElement).open),
    ).toBe(false)
  }

  const firstPane = payloadPanes.first()
  await firstPane.locator('summary').click()
  expect(
    await firstPane.evaluate(element => (element as HTMLDetailsElement).open),
  ).toBe(true)
})
