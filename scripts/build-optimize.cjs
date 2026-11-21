const common = require("./common.cjs");

// electron-builder 的 Arch 枚举值/字符串 → 目录命名映射
// Arch 枚举: ia32=0, x64=1, armv7l=2, arm64=3, universal=4
const ARCH_MAP = {
    // 字符串 key
    x64: "x86", arm64: "arm64", ia32: "x86",
    // 数字枚举 key
    0: "x86", 1: "x86", 3: "arm64",
};

exports.default = async function (context) {
    // 使用 context.arch（目标架构）而非 process.arch（构建机架构），以支持交叉编译
    // 注意: Arch.ia32=0 是 falsy 值，必须用 != null 判断
    const targetArch = context.arch != null ? context.arch : common.platformArch();
    const platformName = common.platformName();
    const platformArch = ARCH_MAP[targetArch] || targetArch;
    const name = platformName + "-" + platformArch;

    console.log("BuildOptimize", { platformName, platformArch, targetArch, name });

    // macOS 本地构建版（make build-install 触发，AIGCPANEL_LOCAL_INSTALL=1）：
    // - 钥匙串已导入 Developer ID 证书时，electron-builder 随后会用证书签名，
    //   授权记录按 TeamID 匹配，重装/升级后授权可持久，无需 adhoc 覆盖。
    // - 无证书（identity=null，不签名）时，用 ad-hoc 重新签名并指定 appId，使签名
    //   identifier 与 bundle 一致，避免 TCC 辅助功能/屏幕录制授权失效；同时保留
    //   hardened runtime 与 entitlements。
    if (platformName === "osx" && process.env.AIGCPANEL_LOCAL_INSTALL === "1") {
        const appDir = common.pathResolve(
            context.appOutDir,
            `${context.packager.appInfo.productFilename}.app`,
        );
        const hasCert = (() => {
            try {
                const out = require("node:child_process").execSync(
                    `security find-identity -v -p codesigning 2>&1`,
                    { encoding: "utf8" },
                );
                return /Developer ID Application/.test(out);
            } catch (e) {
                return false;
            }
        })();
        if (hasCert) {
            console.log("  [sign] 钥匙串已检测到 Developer ID 证书，跳过 adhoc 重新签名");
        } else {
            const appId = context.packager.appInfo.appId || "AIGCPanel";
            const entitlementsPath = require("node:path").resolve(__dirname, "..", "entitlements.mac.plist");
            const exec = require("node:child_process").execSync;
            try {
                exec(
                    `codesign --force --deep --sign - --identifier ${appId} --options runtime --entitlements "${entitlementsPath}" "${appDir}"`,
                    { stdio: "pipe" },
                );
                const sig = exec(
                    `codesign -dv "${appDir}" 2>&1 | grep Identifier`,
                    { encoding: "utf8" },
                );
                console.log(`  [sign] local build re-signed (${sig.trim()})`);
            } catch (e) {
                console.error("  [error] local build re-sign failed:", e.message);
            }
        }
    }

    const srcDir = `electron/resources/extra/${name}`;
    let destDir = null;
    if (platformName === 'osx') {
        destDir = common.pathResolve(
            context.appOutDir,
            `${context.packager.appInfo.productFilename}.app`,
            "Contents",
            "Resources",
            "extra",
            name
        );
    } else if (platformName === 'win') {
        destDir = common.pathResolve(context.appOutDir, "resources", "extra", name);
    } else if (platformName === 'linux') {
        destDir = common.pathResolve(context.appOutDir, "resources", "extra", name);
    }

    console.log("BuildOptimize.copy", {
        platformName,
        platformArch,
        srcDir,
        destDir,
    });

    if (srcDir && common.exists(srcDir)) {
        console.log(`Copying from ${srcDir} to ${destDir}`);
        common.copy(srcDir, destDir, true);
        console.log(`Copy completed`);
    } else {
        console.log(`No matching source directory found for platform: ${platformName}-${platformArch}`);
    }

    // common.listFiles(context.appOutDir, true).forEach((p) => {
    // console.log('BuildOptimize.path', (p.isDir ? 'D:' : 'F:') + p.path);
    // })
    // const localeDir = context.appOutDir + "/AIGCPanel.app/Contents/Frameworks/Electron Framework.framework/Versions/A/Resources/";
    // console.log(`localeDir: ${localeDir}`);
    // fs.readdir(localeDir, function (err, files) {
    //     if (!(files && files.length)) {
    //         return;
    //     }
    //     for (let f of files) {
    //         if (f.endsWith('.lproj')) {
    //             if (!(f.startsWith("en") || f.startsWith("zh"))) {
    //                 const p = localeDir + f;
    //                 console.log(`removeFile: ${p}`);
    //                 fs.rmdirSync(p, {recursive: true});
    //             }
    //         }
    //     }
    // });
};
