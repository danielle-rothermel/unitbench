// Regenerates the dr-code facade client: dumps the OpenAPI schema from
// the library's serve CLI, then emits TypeScript types. Both artifacts
// are committed; rerun with `pnpm gen:api` after facade changes.
//
// Assumes the dr-code `serve` branch is checked out at
// DR_CODE_SERVE_DIR (default: ../dr-code-serve, a git worktree).
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const serveDir =
  process.env.DR_CODE_SERVE_DIR ??
  path.resolve(process.cwd(), '../dr-code-serve')
const outDir = path.resolve(process.cwd(), 'src/lib/api')
const schemaPath = path.join(outDir, 'dr-code-openapi.json')
const typesPath = path.join(outDir, 'dr-code.ts')

console.log(`Dumping OpenAPI schema from ${serveDir} …`)
const schema = execFileSync(
  'uv',
  ['--directory', serveDir, 'run', 'python', '-m', 'dr_code.serve', 'openapi'],
  { encoding: 'utf8' },
)
mkdirSync(outDir, { recursive: true })
writeFileSync(schemaPath, schema)
console.log(`Wrote ${schemaPath}`)

console.log('Generating TypeScript types …')
execFileSync('pnpm', ['exec', 'openapi-typescript', schemaPath, '-o', typesPath], {
  stdio: 'inherit',
})
console.log(`Wrote ${typesPath}`)
