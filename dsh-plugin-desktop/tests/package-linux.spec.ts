import { describe, expect, it } from 'vitest'
import {
  packageLinuxDistribution,
  type LinuxPackageOptions,
} from '../scripts/package-linux.ts'

interface CommandCall {
  readonly command: string
  readonly args: readonly string[]
  readonly cwd: string
  readonly env: NodeJS.ProcessEnv
}

function options(calls: CommandCall[], logs: string[] = []): LinuxPackageOptions {
  return {
    env: {
      PATH: '/usr/local/bin:/usr/bin:/bin',
      SAFE_VALUE: 'kept',
    },
    platform: 'linux',
    arch: 'x64',
    nodeVersion: '22.23.2',
    workspaceRoot: '/repo',
    desktopRoot: '/repo/dsh-plugin-desktop',
    builderCli: '/repo/node_modules/electron-builder/cli.js',
    verifier: '/repo/dsh-plugin-desktop/scripts/verify-linux-package.ts',
    nodeExecutable: '/usr/local/bin/node',
    run: (command, args, cwd, env) => {
      calls.push({ command, args: [...args], cwd, env: { ...env } })
    },
    log: message => logs.push(message),
  }
}

describe('Linux x64 package distribution', () => {
  it('checks, builds AppImage and deb targets, then verifies them', () => {
    const calls: CommandCall[] = []
    const logs: string[] = []

    packageLinuxDistribution(options(calls, logs))

    expect(calls).toHaveLength(3)
    expect(calls[0]).toEqual({
      command: 'corepack',
      args: [
        'yarn',
        'workspace',
        'dsh-plugin-desktop',
        'check:linux-package',
      ],
      cwd: '/repo',
      env: { PATH: '/usr/local/bin:/usr/bin:/bin', SAFE_VALUE: 'kept' },
    })
    expect(calls[1]).toEqual({
      command: '/usr/local/bin/node',
      args: [
        '/repo/node_modules/electron-builder/cli.js',
        '--linux',
        'AppImage',
        'deb',
        '--x64',
        '--publish',
        'never',
        '--config.npmRebuild=false',
      ],
      cwd: '/repo/dsh-plugin-desktop',
      env: {
        PATH: '/usr/local/bin:/usr/bin:/bin',
        SAFE_VALUE: 'kept',
        CSC_IDENTITY_AUTO_DISCOVERY: 'false',
      },
    })
    expect(calls[2]).toEqual({
      command: '/usr/local/bin/node',
      args: ['/repo/dsh-plugin-desktop/scripts/verify-linux-package.ts'],
      cwd: '/repo/dsh-plugin-desktop',
      env: { PATH: '/usr/local/bin:/usr/bin:/bin', SAFE_VALUE: 'kept' },
    })
    expect(logs).toEqual([
      'Building Linux x64 AppImage and DEB packages.',
    ])
  })

  it('reuses a completed CI package gate when explicitly requested', () => {
    const calls: CommandCall[] = []
    const logs: string[] = []
    const value = {
      ...options(calls, logs),
      env: {
        ...options(calls).env,
        DSH_PACKAGE_CHECK_ALREADY_RAN: '1',
      },
    }

    packageLinuxDistribution(value)

    expect(calls).toHaveLength(2)
    expect(calls[0]?.args).toEqual([
      '/repo/node_modules/electron-builder/cli.js',
      '--linux',
      'AppImage',
      'deb',
      '--x64',
      '--publish',
      'never',
      '--config.npmRebuild=false',
    ])
    expect(logs).toEqual([
      'Building Linux x64 AppImage and DEB packages.',
      'Skipping the Linux package preflight; the package gate already passed.',
    ])
  })

  it.each([
    ['darwin', 'x64', '22.23.2', 'native Linux host'],
    ['win32', 'x64', '22.23.2', 'native Linux host'],
    ['linux', 'arm64', '22.23.2', 'requires x64 Node'],
    ['linux', 'x64', '25.0.0', 'Node 22.19+ or Node 24.x'],
  ] as const)(
    'rejects unsupported host %s/%s with Node %s before running commands',
    (platform, arch, nodeVersion, message) => {
      const calls: CommandCall[] = []
      const value = { ...options(calls), platform, arch, nodeVersion }

      expect(() => packageLinuxDistribution(value)).toThrow(message)
      expect(calls).toEqual([])
    },
  )

  it('stops before packaging when the headless check fails', () => {
    const calls: CommandCall[] = []
    const value: LinuxPackageOptions = {
      ...options(calls),
      run: (command, args, cwd, env) => {
        calls.push({ command, args: [...args], cwd, env: { ...env } })
        throw new Error('headless check failed')
      },
    }

    expect(() => packageLinuxDistribution(value)).toThrow('headless check failed')
    expect(calls).toHaveLength(1)
  })
})
