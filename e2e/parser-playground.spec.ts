import { expect, test } from '@playwright/test'

test('renders the dr-code parser extraction trace', async ({ page }) => {
  await page.goto('/playgrounds/parser')

  await page.getByRole('textbox', { name: 'Raw answer' }).fill(`Answer:

\`\`\`python
def add(a, b):
    return a + b
\`\`\`
`)
  await page.getByRole('button', { name: 'Trace parser' }).click()

  await expect(page.getByTestId('trace-result')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Candidate lineage' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Check verdicts' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Selection walk' }),
  ).toBeVisible()
  await expect(
    page.getByText('first candidate passing parser checks').first(),
  ).toBeVisible()
  await expect(page.getByText('compile_validation').first()).toBeVisible()
})
