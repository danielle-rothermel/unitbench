import { expect, test } from '@playwright/test'

const FIXTURE_TEXT = `Here is my solution:

\`\`\`python
def broken(:
\`\`\`

Wait, let me fix that:

\`\`\`python
def add(a, b):
    return a + b
\`\`\`
`

test.describe('parser playground', () => {
  test('explains fixture text against the local facade', async ({ page }) => {
    await page.goto('/playgrounds/parser')
    await expect(page.getByText('local-only')).toBeVisible()

    await page.getByTestId('parser-input').fill(FIXTURE_TEXT)
    await page.getByRole('button', { name: 'Explain' }).click()

    const explanation = page.getByTestId('parser-explanation')
    await expect(explanation).toBeVisible()

    // Candidate tree: a rejected candidate (broken def) and a selected one.
    await expect(explanation.getByText('selected', { exact: true })).toBeVisible()
    await expect(
      explanation.getByText('rejected', { exact: true }).first(),
    ).toBeVisible()

    // Winner rationale and extracted code.
    await expect(page.getByTestId('winner-rationale')).toContainText(
      'selected via',
    )
    await expect(explanation.getByText('Extracted code')).toBeVisible()
  })

  test('stage toggles control which sections render', async ({ page }) => {
    await page.goto('/playgrounds/parser')
    await page.getByTestId('parser-input').fill(FIXTURE_TEXT)

    // Turn off everything except the result stage.
    for (const stage of ['Unwrap', 'Candidates', 'Selection']) {
      await page.getByRole('checkbox', { name: stage }).uncheck()
    }
    await page.getByRole('button', { name: 'Explain' }).click()

    const explanation = page.getByTestId('parser-explanation')
    await expect(explanation).toBeVisible()
    await expect(explanation.getByText('Extracted code')).toBeVisible()
    await expect(explanation.getByText('Candidates (')).toHaveCount(0)
    await expect(page.getByTestId('winner-rationale')).toHaveCount(0)
  })
})
