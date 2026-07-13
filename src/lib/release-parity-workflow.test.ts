import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const WhetstoneProducerSha = '3193c29df89c2776479b1b98d279b6d60d89965a'

function namedStep(workflow: string, name: string): string {
  const start = workflow.indexOf(`      - name: ${name}`)
  expect(start).toBeGreaterThanOrEqual(0)
  const next = workflow.indexOf('\n      - name:', start + 1)
  return workflow.slice(start, next === -1 ? undefined : next)
}

describe('inline release parity workflow', () => {
  it('checks out the exact immutable Whetstone producer without a reusable call', async () => {
    const workflow = await readFile(resolve(process.cwd(), '.github/workflows/release-parity.yml'), 'utf8')
    const checkout = namedStep(workflow, 'Checkout locked Whetstone producer')

    expect(workflow).not.toContain('whetstone-ai/.github/workflows/release-parity.yml@')
    expect(workflow).not.toContain('secrets: inherit')
    expect(workflow).toContain(`WHETSTONE_SHA: ${WhetstoneProducerSha}`)
    expect(checkout).toContain('repository: danielle-rothermel/whetstone-ai')
    expect(checkout).toContain(`ref: ${WhetstoneProducerSha}`)
    expect(checkout).toContain('token: ${{ secrets.GH_DR_ORG_REPOS_READ_TOKEN }}')
    expect(checkout).toContain('persist-credentials: false')
  })

  it('limits the private Git token and signing key to required setup steps', async () => {
    const workflow = await readFile(resolve(process.cwd(), '.github/workflows/release-parity.yml'), 'utf8')
    const consumer = namedStep(workflow, 'Unitbench live delivery-parity evidence')
    const whetstoneInstall = namedStep(workflow, 'Install Whetstone dependencies')
    const unitbenchInstall = namedStep(workflow, 'Install Unitbench dependencies')
    const materialize = namedStep(workflow, 'Materialize ephemeral bundle integrity key')

    expect(workflow.match(/secrets\.GH_DR_ORG_REPOS_READ_TOKEN/g)).toHaveLength(3)
    expect(whetstoneInstall).toContain('secrets.GH_DR_ORG_REPOS_READ_TOKEN')
    expect(unitbenchInstall).toContain('secrets.GH_DR_ORG_REPOS_READ_TOKEN')
    expect(materialize).toContain('secrets.WHETSTONE_BUNDLE_INTEGRITY_PRIVATE_KEY }}')
    expect(consumer).not.toContain('GH_DR_ORG_REPOS_READ_TOKEN')
    expect(consumer).not.toContain('WHETSTONE_BUNDLE_INTEGRITY_PRIVATE_KEY')
    expect(consumer).toContain('UNITBENCH_BUNDLE_INTEGRITY_PUBLIC_KEYS')
  })

  it('keeps least privilege and the complete fail-closed fixture lifecycle', async () => {
    const workflow = await readFile(resolve(process.cwd(), '.github/workflows/release-parity.yml'), 'utf8')

    expect(workflow).toContain('permissions: {}')
    expect(workflow).toContain('permissions:\n      contents: read')
    expect(workflow).toContain('uv sync --frozen --group dev')
    expect(namedStep(workflow, 'Always clean run-owned fixture')).toContain('if: always()')
    expect(namedStep(workflow, 'Verify fail-closed cleanup evidence')).toContain('if: always()')
    expect(namedStep(workflow, 'Remove ephemeral bundle integrity key')).toContain('if: always()')
    expect(namedStep(workflow, 'Upload parity evidence')).toContain(
      'actions/upload-artifact@0b7f8abb1508181956e8e162db84b466c27e18ce',
    )
  })

  it('defines the delivery-parity script invoked by the inline producer', async () => {
    const packageJson = await readFile(resolve(process.cwd(), 'package.json'), 'utf8')
    expect(JSON.parse(packageJson).scripts['check:delivery-parity']).toBe(
      'node scripts/check-delivery-parity.mjs && pnpm test:release-parity',
    )
  })
})
