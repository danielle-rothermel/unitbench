import { expect, test } from '@playwright/test'

test.describe('graph viewer', () => {
  test('renders both fixture specs as DAGs', async ({ page }) => {
    await page.goto('/design/graph')

    await page.getByRole('button', { name: 'Direct sample' }).click()
    await expect(page.getByTestId('graph-rendered')).toBeVisible()
    await expect(page.getByTestId('graph-node')).toHaveCount(1)
    await expect(page.getByTestId('graph-external')).toHaveCount(1)
    await expect(page.getByText('terminal: direct')).toBeVisible()

    await page.getByRole('button', { name: 'Enc-dec sample' }).click()
    await expect(page.getByTestId('graph-node')).toHaveCount(2)
    await expect(page.getByText('terminal: decoder')).toBeVisible()
  })

  test('clicking a node opens its spec in the inspector', async ({ page }) => {
    await page.goto('/design/graph')
    await page.getByRole('button', { name: 'Enc-dec sample' }).click()

    await page.getByTestId('graph-node').first().click()
    await expect(page.getByText(/^Node (encoder|decoder)$/)).toBeVisible()
  })

  test('invalid specs show the schema error', async ({ page }) => {
    await page.goto('/design/graph')

    await page.getByTestId('graph-input').fill('{"nodes": []}')
    await page.getByRole('button', { name: 'Render' }).click()
    await expect(
      page.getByText('Spec does not validate against the GraphSpec schema'),
    ).toBeVisible()
    await expect(page.getByText(/terminal_node_id/)).toBeVisible()

    await page.getByTestId('graph-input').fill('{not json')
    await page.getByRole('button', { name: 'Render' }).click()
    await expect(page.getByText(/not valid JSON/)).toBeVisible()
  })
})
