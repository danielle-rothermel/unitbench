import { EventEmitter } from 'node:events'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  createVercelInstallEnvironment,
  runVercelInstall,
} from './vercel-install.mjs'

const token = 'test-token/that?must=not&appear-in-output'

function childProcess() {
  return Object.assign(new EventEmitter(), {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
  })
}

describe('Vercel private Git dependency install', () => {
  it('configures Git authentication only for the danielle-rothermel GitHub organization', () => {
    const environment = createVercelInstallEnvironment({
      GH_DR_ORG_REPOS_READ_TOKEN: token,
      PATH: '/bin',
    })

    expect(environment).toMatchObject({
      PATH: '/bin',
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: `url.https://x-access-token:${token}@github.com/danielle-rothermel/.insteadOf`,
      GIT_CONFIG_VALUE_0: 'https://github.com/danielle-rothermel/',
    })
    expect('GH_DR_ORG_REPOS_READ_TOKEN' in environment).toBe(false)
  })

  it('spawns the frozen pnpm install directly and redacts raw and URL-encoded credentials from forwarded output', async () => {
    const child = childProcess()
    const spawnProcess = vi.fn(() => child)
    const stdoutWrite = vi.fn()
    const stderrWrite = vi.fn()
    const installation = runVercelInstall({
      environment: { GH_DR_ORG_REPOS_READ_TOKEN: token },
      spawnProcess,
      output: { stdout: { write: stdoutWrite }, stderr: { write: stderrWrite } },
    })

    const encodedToken = encodeURIComponent(token)
    child.stdout.emit('data', `fetching https://x-access-token:${token}@github.com/danielle-rothermel/dr-code`)
    child.stderr.emit('data', `fetching https://x-access-token:${encodedToken}@github.com/danielle-rothermel/dr-code`)
    child.emit('close', 0)
    await installation

    expect(spawnProcess).toHaveBeenCalledWith('pnpm', ['install', '--frozen-lockfile'], expect.objectContaining({
      shell: false,
      stdio: ['inherit', 'pipe', 'pipe'],
    }))
    const forwardedOutput = [...stdoutWrite.mock.calls, ...stderrWrite.mock.calls]
      .map(([message]) => message)
      .join('')
    expect(forwardedOutput).not.toContain(token)
    expect(forwardedOutput).not.toContain(encodedToken)
    expect(forwardedOutput).toContain('[REDACTED]')
  })

  it('fails closed before spawning or logging when the Vercel token is missing', () => {
    const spawnProcess = vi.fn()
    const stdoutWrite = vi.fn()
    const stderrWrite = vi.fn()

    expect(() => runVercelInstall({
      environment: {},
      spawnProcess,
      output: { stdout: { write: stdoutWrite }, stderr: { write: stderrWrite } },
    }))
      .toThrow('GH_DR_ORG_REPOS_READ_TOKEN is required')
    expect(spawnProcess).not.toHaveBeenCalled()
    expect(stdoutWrite).not.toHaveBeenCalled()
    expect(stderrWrite).not.toHaveBeenCalled()
  })

  it('uses the wrapper only as Vercel’s install command', async () => {
    const configuration = JSON.parse(await readFile(resolve(process.cwd(), 'vercel.json'), 'utf8'))

    expect(configuration.installCommand).toBe('node scripts/vercel-install.mjs')
  })
})
