#!/usr/bin/env node
// Update the project version in package.json and package-lock.json.
// Usage:
//   node scripts/update-version.mjs 2.2.0
//   VERSION=2.2.0 node scripts/update-version.mjs
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const newVersion = process.argv[2] || process.env.VERSION;
if (!newVersion) {
  console.error('Usage: node scripts/update-version.mjs <version>');
  console.error('   or: VERSION=<version> node scripts/update-version.mjs');
  process.exit(1);
}
// semver-compatible: major.minor.patch with optional pre-release/build suffix
if (!/^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/.test(newVersion)) {
  console.error(`Invalid version format: "${newVersion}" (expect x.y.z or x.y.z-beta.1)`);
  process.exit(1);
}

const packagePath = resolve(root, 'package.json');
const lockPath = resolve(root, 'package-lock.json');

// package.json
const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
const oldVersion = pkg.version;
pkg.version = newVersion;
writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');

// package-lock.json (top-level + packages[""])
const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
if (lock.version !== undefined) lock.version = newVersion;
if (lock.packages && lock.packages[''] && lock.packages[''].version !== undefined) {
  lock.packages[''].version = newVersion;
}
writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');

console.log(`Version updated: ${oldVersion} -> ${newVersion}`);