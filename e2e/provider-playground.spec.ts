import { expect, test } from '@playwright/test'

test.describe('provider playground', () => {
  test('previews the wire payload and sends a fixture query', async ({
    page,
  }) => {
    await page.goto('/playgrounds/provider')
    await expect(page.getByText('local-only')).toBeVisible()

    await page.getByTestId('provider-prompt').fill('Say hello.')
    await page.getByRole('button', { name: 'Preview payload' }).click()

    const payload = page.getByTestId('provider-payload')
    await expect(payload).toBeVisible()
    await expect(payload.getByText('/chat/completions')).toBeVisible()
    await expect(payload.getByText('"Say hello."')).toBeVisible()

    await page.getByTestId('fixture-text').fill('hello from the fixture')
    await page.getByRole('button', { name: 'Send (fixture)' }).click()

    const response = page.getByTestId('provider-response')
    await expect(response).toBeVisible()
    await expect(
      response.getByText('hello from the fixture', { exact: true }),
    ).toBeVisible()
  })

  test('surfaces conformance violations on the response', async ({ page }) => {
    await page.goto('/playgrounds/provider')

    await page.getByTestId('provider-prompt').fill('Say hello.')
    await page.getByLabel('Token limit').fill('5')
    await page.getByTestId('fixture-tokens').fill('50')
    await page.getByRole('button', { name: 'Send (fixture)' }).click()

    const violations = page.getByTestId('provider-warnings')
    await expect(violations).toBeVisible()
    await expect(violations.getByText('token_limit_exceeded')).toBeVisible()
  })

  test('variance mode reports dispersion across models', async ({ page }) => {
    await page.goto('/playgrounds/provider')

    await page.getByTestId('variance-prompt').fill('Say hello.')
    await page.getByRole('button', { name: 'Run variance' }).click()

    const report = page.getByTestId('variance-report')
    await expect(report).toBeVisible()
    await expect(report.getByRole('cell', { name: 'model-a' })).toBeVisible()
    await expect(report.getByRole('cell', { name: 'model-b' })).toBeVisible()
    await expect(
      report.getByRole('button', { name: /Download JSONL \(6 records\)/ }),
    ).toBeVisible()
  })
})
