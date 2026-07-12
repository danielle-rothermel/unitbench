import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('release parity reusable workflow caller', () => {
  it('passes the exact producer commit as its required immutable input', async () => {
    const workflow = await readFile(resolve(process.cwd(), '.github/workflows/release-parity.yml'), 'utf8')
    const match = workflow.match(/release-parity\.yml@([0-9a-f]{40})/)
    expect(match?.[1]).toBe('b12fd83e8690c5199da218ab7e42285608a286bd')
    expect(workflow).toContain(`whetstone_sha: ${match?.[1]}`)
  })

  it('defines the delivery-parity script invoked by the reusable producer', async () => {
    const packageJson = await readFile(resolve(process.cwd(), 'package.json'), 'utf8')
    expect(JSON.parse(packageJson).scripts['check:delivery-parity']).toBe(
      'node scripts/check-delivery-parity.mjs && pnpm test:release-parity',
    )
  })
})
