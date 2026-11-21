const {notarize} = require("@electron/notarize");
const {execSync} = require("node:child_process");
const {readdirSync, lstatSync} = require("node:fs");
const {resolve, join} = require("node:path");
const common = require('./common.cjs')

const entitlementsPath = resolve(__dirname, '..', 'entitlements.mac.plist');

/**
 * Walk a directory recursively, yielding absolute paths.
 */
function walkDir(dir) {
    const results = [];
    if (!common.exists(dir)) return results;
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const stat = lstatSync(full);
        if (stat.isDirectory()) {
            results.push(...walkDir(full));
        } else {
            results.push(full);
        }
    }
    return results;
}

/**
 * Resolve the first available Developer ID Application certificate identity.
 */
function resolveDeveloperIdentity() {
    const out = execSync(
        `security find-identity -v -p codesigning | grep "Developer ID Application" | head -1 | sed 's/.*"\\(.*\\)"/\\1/'`,
        {encoding: "utf8"}
    ).trim();
    return out;
}

/**
 * Sign every .node file inside the .app bundle using the given identity.
 * This avoids Gatekeeper errors on quarantined apps for unsigned native
 * addons (better-sqlite3, etc.).
 */
function signNodeModules(appPath, identity) {
    if (!identity) {
        console.warn("  • [WARN] No Developer ID Application certificate found, skipping .node signing");
        return;
    }
    const contents = resolve(appPath, "Contents");
    if (!common.exists(contents)) {
        console.warn("  • [WARN] .app/Contents not found, skipping .node signing");
        return;
    }
    const allFiles = walkDir(contents);
    const nodeFiles = allFiles.filter(f => f.endsWith(".node"));
    if (nodeFiles.length === 0) {
        console.log("  • No .node files found, skipping code signing");
        return;
    }
    console.log(`  • Signing ${nodeFiles.length} .node file(s) with identity: ${identity}`);
    for (const file of nodeFiles) {
        try {
            execSync(
                `codesign --sign "${identity}" --force --options runtime --timestamp "${file}" 2>&1`,
                {stdio: ["ignore", "pipe", "pipe"], timeout: 30000}
            );
            console.log(`    ✓ ${file}`);
        } catch (err) {
            console.warn(`    ⚠ Failed to sign ${file}: ${err.stderr || err.message}`);
        }
    }
}

function verifyAppEntitlements(appPath) {
    const output = execSync(
        `codesign -d --entitlements - "${appPath}" 2>&1`,
        {encoding: "utf8", timeout: 30000}
    );
    if (!output.includes("com.apple.security.cs.allow-jit")) {
        throw new Error(`Missing allow-jit entitlement after signing: ${appPath}`);
    }
    console.log("  • Verified .app entitlements include allow-jit");
}

exports.default = async function notarizing(context) {
    const appName = context.packager.appInfo.productFilename;
    const {electronPlatformName, appOutDir} = context;
    console.log(`  • Notarization Start`);
    // THIS MUST BE THE SAME AS THE `appId` property
    // in your electron builder configuration
    const appId = "AIGCPanel";
    const appPath = `${appOutDir}/${appName}.app`;

    // 本地构建安装版（make build-install，AIGCPANEL_LOCAL_INSTALL=1）：
    // 不公证；钥匙串已有 Developer ID 证书时补签 .node 原生模块并重签 app，
    // 保持 CodeResources 一致（避免 Gatekeeper/hardened runtime 校验失败）。
    // 无证书（adhoc 路径）时跳过，保持产物一致。
    if (process.env.AIGCPANEL_LOCAL_INSTALL === "1") {
        console.log(`  • Skipping notarization for local install`);
        const identity = resolveDeveloperIdentity();
        if (identity) {
            signNodeModules(appPath, identity);
            console.log(`  • Re-signing .app bundle to update CodeResources and preserve entitlements`);
            execSync(
                `codesign --sign "${identity}" --force --options runtime --timestamp --entitlements "${entitlementsPath}" "${appPath}" 2>&1`,
                {stdio: ["ignore", "pipe", "pipe"], timeout: 60000}
            );
            verifyAppEntitlements(appPath);
        }
        await common.calcSha256()
        return;
    }

    // We skip notarization if the process is not running on MacOS and
    // if the enviroment variable SKIP_NOTARIZE is set to `true`
    // This is useful for local testing where notarization is useless
    if (
        electronPlatformName !== "darwin" ||
        process.env.SKIP_NOTARIZE === "true"
    ) {
        console.log(`  • Skipping notarization`);
        return;
    }

    // ── Resolve signing identity once ──────────────────────────────
    const identity = resolveDeveloperIdentity();
    // ── Sign all .node files before notarization ───────────────────
    signNodeModules(appPath, identity);

    // Re-sign the .app root bundle (without --deep) to update CodeResources,
    // so the hashes of re-signed .node files match. Otherwise codesign --verify
    // --deep --strict will report "file modified" on those .node files.
    if (identity) {
        console.log(`  • Re-signing .app bundle to update CodeResources and preserve entitlements`);
        execSync(
            `codesign --sign "${identity}" --force --options runtime --timestamp --entitlements "${entitlementsPath}" "${appPath}" 2>&1`,
            {stdio: ["ignore", "pipe", "pipe"], timeout: 60000}
        );
        verifyAppEntitlements(appPath);
    }

    let {APPLE_ID, APPLE_ID_PASSWORD, APPLE_TEAM_ID} = process.env;
    if (!APPLE_ID) {
        console.info("  • Notarization ignore: APPLE_ID is empty");
        await common.calcSha256()
        return;
    }
    const notarizeOption = {
        tool: "notarytool",
        appBundleId: appId,
        appPath,
        appleId: APPLE_ID,
        appleIdPassword: APPLE_ID_PASSWORD,
        teamId: APPLE_TEAM_ID,
        verbose: true,
    }
    console.log(`  • Notarizing`, `appPath:${appPath} notarizeOption:${JSON.stringify(notarizeOption)}`);
    try {
        const result = await notarize(notarizeOption);
        console.log("  • Notarization successful!");
        await common.calcSha256()
        return result;
    } catch (error) {
        console.error("  • Notarization failed:", error.message);
        console.error("  • Stack trace:", error.stack);
        await common.calcSha256()
        throw new Error(`Notarization failed: ${error.message}`);
    }

};
