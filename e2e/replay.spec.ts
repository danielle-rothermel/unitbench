import { expect, test } from '@playwright/test'

test.describe('replay viewer', () => {
  test('walks a fixture run end-to-end step by step', async ({ page }) => {
    await page.goto('/replay')

    const currentStep = page.getByTestId('replay-current-step')
    await expect(page.getByText('Step 1 of 2')).toBeVisible()
    await expect(
      currentStep.getByText('encoder', { exact: true }),
    ).toBeVisible()
    await expect(currentStep.getByText('Resolved inputs')).toBeVisible()
    await expect(currentStep.getByText('Output')).toBeVisible()

    await page.getByRole('button', { name: 'Next →' }).click()
    await expect(page.getByText('Step 2 of 2')).toBeVisible()
    await expect(
      currentStep.getByText('decoder', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Next →' }),
    ).toBeDisabled()

    // The failed run exposes the error payload and the retry attempt.
    await page
      .getByRole('combobox')
      .selectOption('fixture-run-failed')
    await expect(page.getByText('Step 1 of 3')).toBeVisible()
    await page.getByRole('button', { name: 'decoder#0' }).click()
    await expect(currentStep.getByText('Error')).toBeVisible()
    await expect(currentStep.getByText('failed', { exact: true })).toBeVisible()
  })

  test('compare view diffs two runs sharing a graph digest', async ({
    page,
  }) => {
    await page.goto('/replay')
    await page.getByRole('button', { name: 'Compare runs' }).click()

    const compare = page.getByTestId('replay-compare')
    await expect(compare).toBeVisible()

    const nodes = page.getByTestId('replay-compare-node')
    await expect(nodes).toHaveCount(2)
    await expect(
      nodes.filter({ hasText: 'encoder' }).getByText('differs'),
    ).toBeVisible()
    await expect(
      nodes.filter({ hasText: 'decoder' }).getByText('code', { exact: true }),
    ).toBeVisible()
  })
})
