// Generate an electron-builder config that only builds for the current platform+arch.
// Ported from focusany-pro scripts/gen-electron-builder-config.mjs.
// Usage: node scripts/gen-electron-builder-config.mjs
// Output: _temp/electron-builder-native-config.json
//
// This avoids cross-compilation — only the native arch is targeted.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSON5 from 'json5';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

// ── Read base config ──────────────────────────────────────────────
const baseConfigPath = resolve(rootDir, 'electron-builder.json5');
const baseConfig = JSON5.parse(readFileSync(baseConfigPath, 'utf-8'));

// ── Map current platform/arch ─────────────────────────────────────
const platform = process.platform; // 'darwin' | 'win32' | 'linux'
const arch = process.arch;         // 'arm64' | 'x64'

const platformMap = {
  darwin: { name: 'mac', extraDir: 'osx' },
  win32:  { name: 'win', extraDir: 'win' },
  linux:  { name: 'linux', extraDir: 'linux' },
};

const info = platformMap[platform];
if (!info) {
  console.error(`Unsupported platform: ${platform}`);
  process.exit(1);
}

// Support TARGET_ARCH env for cross-compilation (e.g. build x64 on arm64)
const targetArch = process.env.TARGET_ARCH || arch;
const archName = targetArch; // 'arm64' or 'x64'

const buildLabel = targetArch === arch ? `${info.name}-${archName}` : `${info.name}-${archName} (native=${arch})`;
console.log(`Generating native config for ${buildLabel}`);

// ── Build native-only config ──────────────────────────────────────
const platformSection = baseConfig[info.name];
if (!platformSection) {
  console.error(`Base config missing section for platform: ${info.name}`);
  process.exit(1);
}

// Deep clone
const nativeConfig = JSON.parse(JSON.stringify(baseConfig));

// 1. Override target: only build for the current arch
const platformTarget = nativeConfig[info.name].target;
for (const t of platformTarget) {
  t.arch = [archName];
}

// 2. On macOS, allow code signing when the keychain has a Developer ID certificate
//    (electron-builder auto-discovers it) or for non-local builds (CI has the cert).
//    Local installs without a cert keep identity=null; the adhoc fallback in
//    build-optimize.cjs then fixes the identifier and entitlements.
const hasDeveloperIdCert = () => {
  try {
    const out = execSync('security find-identity -v -p codesigning 2>/dev/null', {encoding: 'utf8'});
    return /Developer ID Application/.test(out);
  } catch (e) {
    return false;
  }
};

if (platform === 'darwin' && (!process.env.AIGCPANEL_LOCAL_INSTALL || hasDeveloperIdCert())) {
  delete nativeConfig.mac.identity;
  nativeConfig.mac.type = 'distribution';
}

// ── Write output ──────────────────────────────────────────────────
const outDir = resolve(rootDir, '_temp');
mkdirSync(outDir, { recursive: true });

const outPath = resolve(outDir, 'electron-builder-native-config.json');
writeFileSync(outPath, JSON.stringify(nativeConfig, null, 2));

console.log(`Native config written to: ${outPath}`);
