import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const WhetstoneProducerSha = '679177ca99a3b608bb1b91978d7d9cdd74b095e7'
const CalledWorkflowSecrets = [
  'DATABASE_URL',
  'GH_DR_ORG_REPOS_READ_TOKEN',
  'MOTHERDUCK_DATABASE_URL',
  'NEON_DATABASE_URL',
  'UNITBENCH_RELEASE_PARITY_TOKEN',
  'WHETSTONE_BUNDLE_INTEGRITY_KEY_ID',
  'WHETSTONE_BUNDLE_INTEGRITY_PRIVATE_KEY',
  'WHETSTONE_BUNDLE_INTEGRITY_PUBLIC_KEY_RING',
]

describe('release parity reusable workflow caller', () => {
  it('denies permissions globally and grants only job-scoped contents read', async () => {
    const workflow = await readFile(resolve(process.cwd(), '.github/workflows/release-parity.yml'), 'utf8')

    expect(workflow.match(/permissions:/g)).toHaveLength(2)
    expect(workflow).toContain(
      'permissions: {}\n\njobs:\n  whetstone-owned-fixture:\n    permissions:\n      contents: read\n',
    )
  })

  it('pins the exact immutable Whetstone producer and input', async () => {
    const workflow = await readFile(resolve(process.cwd(), '.github/workflows/release-parity.yml'), 'utf8')
    const match = workflow.match(/release-parity\.yml@([0-9a-f]{40})/)

    expect(match?.[1]).toBe(WhetstoneProducerSha)
    expect(workflow).toContain(`whetstone_sha: ${WhetstoneProducerSha}`)
  })

  it('maps every declared called-workflow secret explicitly', async () => {
    const workflow = await readFile(resolve(process.cwd(), '.github/workflows/release-parity.yml'), 'utf8')
    const mappedSecrets = [...workflow.matchAll(/^ {6}([A-Z][A-Z0-9_]+):/gm)]
      .map((match) => match[1])
      .sort()

    expect(mappedSecrets).toEqual(CalledWorkflowSecrets)
    for (const secret of CalledWorkflowSecrets) {
      expect(workflow).toContain(`${secret}: \${{ secrets.${secret} }}`)
    }
    expect(workflow).not.toContain('secrets: inherit')
  })

  it('defines the delivery-parity script invoked by the reusable producer', async () => {
    const packageJson = await readFile(resolve(process.cwd(), 'package.json'), 'utf8')
    expect(JSON.parse(packageJson).scripts['check:delivery-parity']).toBe(
      'node scripts/check-delivery-parity.mjs && pnpm test:release-parity',
    )
  })
})
