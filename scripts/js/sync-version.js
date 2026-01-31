#!/usr/bin/env node

/**
 * Syncs the version from root package.json to frontend and backend package.json files.
 * This script is automatically called by `pnpm version` via the "version" lifecycle hook.
 *
 * Usage:
 *   pnpm version patch   # 0.1.0 -> 0.1.1
 *   pnpm version minor   # 0.1.0 -> 0.2.0
 *   pnpm version major   # 0.1.0 -> 1.0.0
 *   pnpm version 1.2.3   # Set specific version
 */

const fs = require('fs')
const path = require('path')

const rootDir = path.join(__dirname, '..')
const rootPkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'))
const version = rootPkg.version

const targets = [
  'apps/frontend/package.json',
  'apps/backend/package.json',
]

console.log(`Syncing version ${version} to workspace packages...`)

for (const target of targets) {
  const targetPath = path.join(rootDir, target)

  if (!fs.existsSync(targetPath)) {
    console.warn(`  Warning: ${target} not found, skipping`)
    continue
  }

  const pkg = JSON.parse(fs.readFileSync(targetPath, 'utf8'))
  const oldVersion = pkg.version

  if (oldVersion === version) {
    console.log(`  ${target}: already at ${version}`)
    continue
  }

  pkg.version = version
  fs.writeFileSync(targetPath, JSON.stringify(pkg, null, 2) + '\n')
  console.log(`  ${target}: ${oldVersion} -> ${version}`)
}

console.log('Version sync complete.')
