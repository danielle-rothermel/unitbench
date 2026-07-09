// Regenerates the GraphSpec JSON schema from dr-graph (read-only).
// Rerun with `pnpm gen:graph-schema` after dr-graph model changes.
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import path from 'node:path'

const graphDir =
  process.env.DR_GRAPH_DIR ?? path.resolve(process.cwd(), '../dr-graph')
const outPath = path.resolve(
  process.cwd(),
  'src/lib/api/graph-spec-schema.json',
)

const EXPORT_SCHEMA = [
  'import json',
  'from dr_graph.models import GraphSpec',
  'print(json.dumps(GraphSpec.model_json_schema(), sort_keys=True))',
].join('; ')

console.log(`Exporting GraphSpec schema from ${graphDir} …`)
const raw = execFileSync(
  'uv',
  ['--directory', graphDir, 'run', 'python', '-c', EXPORT_SCHEMA],
  { encoding: 'utf8' },
)
const schema = JSON.parse(raw)

// dr-graph accepts (and serializes) "node.field" strings for input
// bindings via a before-validator, but its generated schema only lists
// the BindingRef object form; widen to match the real wire format.
schema.$defs.NodeConfig.properties.input_bindings.additionalProperties = {
  anyOf: [{ type: 'string' }, { $ref: '#/$defs/BindingRef' }],
}

writeFileSync(outPath, `${JSON.stringify(schema, null, 2)}\n`)
console.log(`Wrote ${outPath}`)
