import { expect, test } from '@playwright/test'

test('home page renders the table directory without console errors', async ({
  page,
}) => {
  const consoleErrors: string[] = []
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.goto('/')

  await expect(
    page.getByRole('main').getByRole('heading', { level: 1, name: 'Unitbench' }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: /predictions/i }).first()).toBeVisible()

  expect(consoleErrors).toEqual([])
})
