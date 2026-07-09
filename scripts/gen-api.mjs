// Regenerates the library-facade clients: dumps each facade's OpenAPI
// schema from its serve CLI, then emits TypeScript types. All
// artifacts are committed; rerun with `pnpm gen:api` after facade
// changes.
//
// Assumes each library's `serve` branch is checked out at the listed
// directory (git worktrees by default; override with the env vars).
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const FACADES = [
  {
    name: 'dr-code',
    dir: process.env.DR_CODE_SERVE_DIR ?? '../dr-code-serve',
    module: 'dr_code.serve',
  },
  {
    name: 'dr-providers',
    dir: process.env.DR_PROVIDERS_SERVE_DIR ?? '../dr-providers-serve',
    module: 'dr_providers.serve',
  },
]

const outDir = path.resolve(process.cwd(), 'src/lib/api')
mkdirSync(outDir, { recursive: true })

for (const facade of FACADES) {
  const serveDir = path.resolve(process.cwd(), facade.dir)
  const schemaPath = path.join(outDir, `${facade.name}-openapi.json`)
  const typesPath = path.join(outDir, `${facade.name}.ts`)

  console.log(`Dumping ${facade.name} OpenAPI schema from ${serveDir} …`)
  const schema = execFileSync(
    'uv',
    ['--directory', serveDir, 'run', 'python', '-m', facade.module, 'openapi'],
    { encoding: 'utf8' },
  )
  writeFileSync(schemaPath, schema)

  console.log(`Generating ${facade.name} TypeScript types …`)
  execFileSync(
    'pnpm',
    ['exec', 'openapi-typescript', schemaPath, '-o', typesPath],
    { stdio: 'inherit' },
  )
  console.log(`Wrote ${typesPath}`)
}
