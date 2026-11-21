// Unified build script for AIGCPanel.
// Ported from focusany-pro scripts/build.mjs.
//   npm run build                  -> native arch
//   TARGET_ARCH=x64 npm run build  -> cross-compile x64 on arm64
//
// Flow:
//   1. Run vite build
//   2. Generate native electron-builder config
//   3. Run electron-builder

import {execSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

function run(cmd) {
    console.log(`  + ${cmd}`);
    try {
        execSync(cmd, {cwd: rootDir, stdio: ['inherit', 'inherit', 'pipe'], shell: true});
    } catch (e) {
        const stderr = (e.stderr && e.stderr.toString().trim()) || '(no stderr)';
        process.stderr.write(stderr + '\n');
        throw new Error(`Command failed (exit ${e.status}): ${cmd}\n${stderr}`);
    }
}

function getVersion() {
    const pkg = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf-8'));
    return pkg.version;
}

const version = getVersion();
const nativeArch = process.arch;
const targetArch = process.env.TARGET_ARCH || nativeArch;

console.log(`\n─── Build plan ───`);
console.log(`  version=${version}`);
console.log(`  platform=${process.platform}`);
console.log(`  nativeArch=${nativeArch}`);
console.log(`  targetArch=${targetArch}`);

// ================================================================
// 1. Vite build
// ================================================================
console.log(`\n─── Vite build ───`);
run('cross-env VITE_RELEASE=1 npx vite build');

// ================================================================
// 2. Generate native electron-builder config
// ================================================================
console.log(`\n─── Generate native config ───`);
run('node scripts/gen-electron-builder-config.mjs');

// ================================================================
// 3. electron-builder with native config
// ================================================================
console.log(`\n─── electron-builder ───`);
const platformFlag = process.platform === 'darwin' ? '--mac' : process.platform === 'win32' ? '--win' : '--linux';
run(`npx electron-builder --config _temp/electron-builder-native-config.json ${platformFlag}`);
