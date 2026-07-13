import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const FACADES = {
  'dr-code': {
    sourceDir: '../dr-code',
    module: 'dr_code.serve',
    openapiPath: 'src/lib/api/dr-code-openapi.json',
    typesPath: 'src/lib/api/dr-code.ts',
  },
  'dr-providers': {
    sourceDir: '../dr-providers',
    module: 'dr_providers.serve',
    openapiPath: 'src/lib/api/dr-providers-openapi.json',
    typesPath: 'src/lib/api/dr-providers.ts',
  },
}

const selectedFacades = process.argv.slice(2)
const facadeNames = selectedFacades.length > 0 ? selectedFacades : ['dr-code']

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  })

  if (result.status !== 0) {
    throw new Error(
      [
        `${command} ${args.join(' ')} failed with status ${result.status}`,
        result.stderr.trim(),
        result.stdout.trim(),
      ]
        .filter(Boolean)
        .join('\n'),
    )
  }

  return result.stdout
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(JSON.parse(value), null, 2)}\n`)
}

for (const facadeName of facadeNames) {
  const facade = FACADES[facadeName]
  if (!facade) {
    throw new Error(`Unknown facade: ${facadeName}`)
  }

  const openapiPath = resolve(facade.openapiPath)
  const typesPath = resolve(facade.typesPath)
  const openapi = run('uv', [
    '--directory',
    facade.sourceDir,
    'run',
    'python',
    '-m',
    facade.module,
    'openapi',
  ])

  writeJson(openapiPath, openapi)
  mkdirSync(dirname(typesPath), { recursive: true })
  run('pnpm', [
    'exec',
    'openapi-typescript',
    openapiPath,
    '--output',
    typesPath,
    '--export-type',
    '--alphabetize',
  ], { stdio: 'inherit' })

  console.log(`generated ${facade.openapiPath} and ${facade.typesPath}`)
}
