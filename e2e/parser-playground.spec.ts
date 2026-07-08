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
  await expect(page.getByText('humaneval-best-effort@v1')).toBeVisible()
  await expect(page.getByText('candidate 0', { exact: true })).toBeVisible()
  await expect(page.getByText('selected', { exact: true })).toBeVisible()
  await expect(page.getByText('compile_validation').first()).toBeVisible()
})
