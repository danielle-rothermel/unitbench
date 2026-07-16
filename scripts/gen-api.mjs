import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

const DEFAULT_FACADE_NAMES = ['dr-providers']

export function resolveFacades(selectedFacades, environment = process.env) {
  const facadeNames =
    selectedFacades.length > 0 ? selectedFacades : DEFAULT_FACADE_NAMES
  const facades = {
    'dr-providers': {
      sourceDir: environment.DR_PROVIDERS_SERVE_DIR ?? '../dr-providers-serve',
      module: 'dr_providers.serve',
      openapiPath: 'src/lib/api/dr-providers-openapi.json',
      typesPath: 'src/lib/api/dr-providers.ts',
    },
  }

  return facadeNames.map(facadeName => {
    const facade = facades[facadeName]
    if (!facade) throw new Error(`Unknown facade: ${facadeName}`)
    return { name: facadeName, ...facade }
  })
}

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

export function main(selectedFacades = process.argv.slice(2)) {
  for (const facade of resolveFacades(selectedFacades)) {
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
    run(
      'pnpm',
      [
        'exec',
        'openapi-typescript',
        openapiPath,
        '--output',
        typesPath,
        '--export-type',
        '--alphabetize',
      ],
      { stdio: 'inherit' },
    )

    console.log(`generated ${facade.openapiPath} and ${facade.typesPath}`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main()
}
