#!/usr/bin/env node
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parseLocalDeployArgs } from './local-deploy-utils.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')

function help() {
  return `
Build and run Scope Shield privately on this computer, with Feishu enabled.

Usage:
  npm run deploy:local -- [--host 127.0.0.1] [--port 4173] [--no-open] [--skip-build] [--strict-port] [--shutdown-on-idle]

Examples:
  npm run deploy:local
  npm run deploy:local -- --port 8080
  npm run deploy:local -- --no-open
`.trim()
}

function runChecked(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false,
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function main() {
  const options = parseLocalDeployArgs(process.argv.slice(2), {
    host: '127.0.0.1',
    feishu: true,
  })
  if (options.help) {
    console.log(help())
    return
  }

  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  if (!options.skipBuild) {
    runChecked(npmCommand, ['run', 'build'])
  }

  const args = [
    path.join(here, 'serve-dist.mjs'),
    '--root',
    options.root,
    '--host',
    options.host,
    '--port',
    String(options.port),
  ]
  if (options.feishu) args.push('--feishu')
  if (!options.open) args.push('--no-open')
  if (options.strictPort) args.push('--strict-port')
  if (options.shutdownOnIdle) args.push('--shutdown-on-idle')
  if (options.idleTimeoutMs !== 20_000) args.push('--idle-timeout-ms', String(options.idleTimeoutMs))
  if (options.autoFeishuLogin) args.push('--auto-feishu-login')

  const child = spawn(process.execPath, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false,
  })
  child.on('exit', (code) => {
    process.exit(code ?? 0)
  })
}

main()
