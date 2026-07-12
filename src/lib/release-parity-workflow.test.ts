import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const WhetstoneProducerSha = 'e33e4d9e18e6deda6e1423f83a36b5673985ccca'

describe('release parity reusable workflow caller', () => {
  it('pins the signed Whetstone producer and passes its exact immutable input', async () => {
    const workflow = await readFile(resolve(process.cwd(), '.github/workflows/release-parity.yml'), 'utf8')
    const match = workflow.match(/release-parity\.yml@([0-9a-f]{40})/)
    expect(match?.[1]).toBe(WhetstoneProducerSha)
    expect(workflow).toContain(`whetstone_sha: ${WhetstoneProducerSha}`)
  })

  it('inherits the producer public-ring secret contract for consumer verification', async () => {
    const workflow = await readFile(resolve(process.cwd(), '.github/workflows/release-parity.yml'), 'utf8')

    expect(workflow).toContain('secrets: inherit')
  })

  it('defines the delivery-parity script invoked by the reusable producer', async () => {
    const packageJson = await readFile(resolve(process.cwd(), 'package.json'), 'utf8')
    expect(JSON.parse(packageJson).scripts['check:delivery-parity']).toBe(
      'node scripts/check-delivery-parity.mjs && pnpm test:release-parity',
    )
  })
})
