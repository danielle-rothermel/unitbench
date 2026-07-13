import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const required = ['UNITBENCH_DELIVERY_PARITY', 'UNITBENCH_DELIVERY_PARITY_DESCRIPTOR', 'LOCAL_ANALYSIS_DATABASE_PATH', 'ANALYSIS_DATABASE_URL', 'DATABASE_URL']
for (const name of required) if (!process.env[name]?.trim()) throw new Error(`release parity evidence is absent: ${name}`)
if (process.env.UNITBENCH_DELIVERY_PARITY !== '1') throw new Error('release parity requires UNITBENCH_DELIVERY_PARITY=1')
if (!existsSync(process.env.UNITBENCH_DELIVERY_PARITY_DESCRIPTOR)) throw new Error('release parity descriptor does not exist')
const result = spawnSync('pnpm', ['vitest', 'run', 'src/lib/delivery-parity.test.ts'], { stdio: 'inherit', env: { ...process.env, UNITBENCH_RELEASE_PARITY: '1' } })
if (result.status !== 0) process.exit(result.status ?? 1)
