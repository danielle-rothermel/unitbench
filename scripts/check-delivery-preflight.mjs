import { readFile, readdir } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import ts from 'typescript'

const ROOT = new URL('../', import.meta.url)
const SOURCE_EXTENSIONS = new Set(['.js', '.mjs', '.ts', '.tsx'])
const DATABASE_ENV_NAMES = new Set(['ANALYSIS_DATABASE_URL', 'DATABASE_URL'])
const PUBLIC_DATABASE_ENV_NAMES = new Set([
  'NEXT_PUBLIC_ANALYSIS_DATABASE_URL',
  'NEXT_PUBLIC_DATABASE_URL',
])
const NATIVE_DUCKDB_PATTERN =
  /(?:^|[/\\])(?:@duckdb[/\\][^/\\]+|duckdb)(?:@|[/\\]|$)/

const failures = []

async function sourceFiles(directory) {
  const absoluteDirectory = new URL(`${directory}/`, ROOT)
  const entries = await readdir(absoluteDirectory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await sourceFiles(path)))
    } else if (SOURCE_EXTENSIONS.has(extname(entry.name))) {
      files.push(path)
    }
  }
  return files
}

async function allFiles(directory) {
  const absoluteDirectory = new URL(`${directory}/`, ROOT)
  const entries = await readdir(absoluteDirectory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await allFiles(path)))
    } else {
      files.push(path)
    }
  }
  return files
}

function isTestFile(path) {
  return /\.(?:integration\.)?test\.[cm]?[jt]sx?$/.test(path)
}

async function text(path) {
  return readFile(new URL(path, ROOT), 'utf8')
}

function requireCheck(condition, message) {
  if (!condition) failures.push(message)
}

function isProcessEnvironment(node) {
  return (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'process' &&
    node.name.text === 'env'
  )
}

function bindingEnvironmentName(element) {
  const sourceName = element.propertyName ?? element.name
  if (ts.isIdentifier(sourceName) || ts.isStringLiteral(sourceName)) {
    return sourceName.text
  }
  return undefined
}

function environmentAccesses(path, contents) {
  const scriptKind = path.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : path.endsWith('.jsx')
      ? ts.ScriptKind.JSX
      : path.endsWith('.js') || path.endsWith('.mjs')
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS
  const source = ts.createSourceFile(
    path,
    contents,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  )
  const names = new Set()
  let importsServerOnly = false

  function visit(node) {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text === 'server-only'
    ) {
      importsServerOnly = true
    }

    if (
      ts.isPropertyAccessExpression(node) &&
      isProcessEnvironment(node.expression)
    ) {
      names.add(node.name.text)
    }

    if (
      ts.isElementAccessExpression(node) &&
      isProcessEnvironment(node.expression) &&
      node.argumentExpression &&
      (ts.isStringLiteral(node.argumentExpression) ||
        ts.isNoSubstitutionTemplateLiteral(node.argumentExpression))
    ) {
      names.add(node.argumentExpression.text)
    }

    if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.initializer &&
      isProcessEnvironment(node.initializer)
    ) {
      for (const element of node.name.elements) {
        const name = bindingEnvironmentName(element)
        if (name) names.add(name)
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(source)
  return { importsServerOnly, names }
}

const syntaxProbe = environmentAccesses(
  'delivery-preflight-syntax-probe.ts',
  `
    import 'server-only'
    const dot = process.env.DATABASE_URL
    const bracket = process.env['ANALYSIS_DATABASE_URL']
    const {
      DATABASE_URL: detail,
      NEXT_PUBLIC_ANALYSIS_DATABASE_URL: publicAnalysis,
    } = process.env
  `,
)
requireCheck(
  syntaxProbe.importsServerOnly &&
    syntaxProbe.names.has('DATABASE_URL') &&
    syntaxProbe.names.has('ANALYSIS_DATABASE_URL') &&
    syntaxProbe.names.has('NEXT_PUBLIC_ANALYSIS_DATABASE_URL'),
  'database environment AST probe did not recognize dot, bracket, and destructured access',
)

const packageJson = JSON.parse(await text('package.json'))
const layout = await text('src/app/layout.tsx')
requireCheck(
  /export const runtime\s*=\s*['"]nodejs['"]/.test(layout),
  "src/app/layout.tsx must declare the Node.js runtime",
)

const productionDependencies = Object.keys(packageJson.dependencies ?? {})
requireCheck(
  !productionDependencies.some(dependency =>
    dependency === 'duckdb' || dependency.startsWith('@duckdb/'),
  ),
  'native DuckDB packages must not be production dependencies',
)

for (const path of await sourceFiles('src')) {
  const contents = await text(path)
  const access = environmentAccesses(path, contents)
  const publicDatabaseNames = [...access.names].filter(name =>
    PUBLIC_DATABASE_ENV_NAMES.has(name),
  )
  requireCheck(
    publicDatabaseNames.length === 0,
    `${path} exposes database configuration through ${publicDatabaseNames.join(', ')}`,
  )

  const databaseNames = [...access.names].filter(name =>
    DATABASE_ENV_NAMES.has(name),
  )
  if (!isTestFile(path) && databaseNames.length > 0) {
    requireCheck(
      access.importsServerOnly,
      `${path} reads ${databaseNames.join(', ')} without importing server-only`,
    )
  }
}

try {
  const traceFiles = (await allFiles('.next/server')).filter(path =>
    path.endsWith('.nft.json'),
  )
  requireCheck(
    traceFiles.length > 0,
    'no production Next traces found; run `pnpm build` before this check',
  )
  for (const path of traceFiles) {
    const trace = JSON.parse(await text(path))
    const nativeEntries = (trace.files ?? []).filter(file =>
      NATIVE_DUCKDB_PATTERN.test(file),
    )
    requireCheck(
      nativeEntries.length === 0,
      `${relative('.', path)} includes native DuckDB in its production trace`,
    )
  }
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
  requireCheck(
    false,
    'no production Next traces found; run `pnpm build` before this check',
  )
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`)
  process.exitCode = 1
} else {
  console.log('PASS Node runtime is explicit')
  console.log(
    'PASS dot, bracket, and destructured database environment access remains server-only',
  )
  console.log('PASS native DuckDB is absent from production dependencies and traces')
}
