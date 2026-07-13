import { spawn } from 'node:child_process'

const TOKEN_ENVIRONMENT_VARIABLE = 'GH_DR_ORG_REPOS_READ_TOKEN'
const GITHUB_ORGANIZATION_URL = 'https://github.com/danielle-rothermel/'

/** @typedef {Record<string, string | undefined>} Environment */
/** @typedef {{ on(event: 'data', listener: (chunk: unknown) => void): unknown }} OutputStream */
/** @typedef {{ stdout?: OutputStream, stderr?: OutputStream, once(event: string, listener: (code?: number) => void): unknown }} InstallChild */
/** @typedef {(command: string, arguments_: string[], options: { env: Environment, shell: false, stdio: ['inherit', 'pipe', 'pipe'] }) => InstallChild} SpawnProcess */
/** @typedef {{ stdout: { write(message: string): unknown }, stderr: { write(message: string): unknown } }} Output */

/** @param {Environment} environment */
export function createVercelInstallEnvironment(environment) {
  const token = environment[TOKEN_ENVIRONMENT_VARIABLE]?.trim()
  if (!token) {
    throw new Error(`${TOKEN_ENVIRONMENT_VARIABLE} is required for the Vercel dependency installation.`)
  }

  const { [TOKEN_ENVIRONMENT_VARIABLE]: _token, ...childEnvironment } = environment
  return {
    ...childEnvironment,
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: `url.https://x-access-token:${token}@github.com/danielle-rothermel/.insteadOf`,
    GIT_CONFIG_VALUE_0: GITHUB_ORGANIZATION_URL,
  }
}

export function redactToken(message, token) {
  return [token, encodeURIComponent(token)]
    .filter((value, index, values) => values.indexOf(value) === index)
    .reduce((redactedMessage, value) => redactedMessage.split(value).join('[REDACTED]'), message)
}

/**
 * @param {{ environment?: Environment, spawnProcess?: SpawnProcess, output?: Output }} options
 */
export function runVercelInstall({
  environment = process.env,
  spawnProcess = (command, arguments_, options) => spawn(command, arguments_, options),
  output = process,
} = {}) {
  const token = environment[TOKEN_ENVIRONMENT_VARIABLE]?.trim()
  const childEnvironment = createVercelInstallEnvironment(environment)

  return new Promise((resolve, reject) => {
    const child = spawnProcess('pnpm', ['install', '--frozen-lockfile'], {
      env: childEnvironment,
      shell: false,
      stdio: ['inherit', 'pipe', 'pipe'],
    })

    const forwardOutput = (stream, destination) => stream?.on('data', chunk => {
      destination.write(redactToken(String(chunk), token))
    })
    forwardOutput(child.stdout, output.stdout)
    forwardOutput(child.stderr, output.stderr)

    child.once('error', () => reject(new Error('Vercel dependency installation could not start.')))
    child.once('close', code => {
      if (code === 0) resolve()
      else reject(new Error(`Vercel dependency installation failed with exit code ${code ?? 'unknown'}.`))
    })
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    await runVercelInstall()
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
