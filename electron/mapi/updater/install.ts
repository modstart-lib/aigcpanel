/**
 * 平台安装逻辑：把已经下载并校验过的更新包应用到本机。
 *
 * - Linux: 替换 AppImage（AIGCPANEL_UPDATE_TARGET 可用于测试）
 * - Windows: setup 走 NSIS 静默安装；portable/exe 走「退出后替换 exe」批处理
 * - macOS: zip 解包后替换 .app；dmg 挂载后替换 .app
 */
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { UpdaterAsset } from "./index";

export type InstallResult = {
    message: string;
    /** 是否已经启动新版本 / 需要退出当前进程 */
    restartRequired: boolean;
};

const isNoRelaunch = () =>
    ["1", "true"].includes(String(process.env.AIGCPANEL_UPDATE_NO_RELAUNCH));

const copyFile = (src: string, dest: string, mode = 0o755) => {
    fs.copyFileSync(src, dest);
    try {
        fs.chmodSync(dest, mode);
    } catch (e) {
        // Windows 上 chmod 无意义
    }
};

const ensureDir = (filePath: string) => {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

/**
 * 找到当前运行中的 .app bundle
 * .../AigcPanel.app/Contents/MacOS/AigcPanel -> .../AigcPanel.app
 */
const currentAppBundle = (): string => {
    let current = process.execPath;
    for (let i = 0; i < 3; i++) {
        current = path.dirname(current);
    }
    if (!current.endsWith(".app")) {
        throw new Error("NOT_APP_BUNDLE");
    }
    return current;
};

const findAppBundle = (dir: string): string | null => {
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of list) {
        const full = path.join(dir, item.name);
        if (item.isDirectory()) {
            if (item.name.endsWith(".app")) {
                return full;
            }
            const found = findAppBundle(full);
            if (found) {
                return found;
            }
        }
    }
    return null;
};

const shellQuote = (value: string) => `'${value.replace(/'/g, "'\\''")}'`;

const installLinux = (
    asset: UpdaterAsset,
    downloaded: string,
): InstallResult => {
    if (asset.kind !== "AppImage") {
        throw new Error("UNSUPPORTED_PACKAGE");
    }
    const target = process.env.AIGCPANEL_UPDATE_TARGET || process.env.APPIMAGE;
    if (!target) {
        throw new Error("NOT_APPIMAGE");
    }
    ensureDir(target);
    const next = target + ".new";
    const backup = target + ".old";
    copyFile(downloaded, next, 0o755);
    try {
        if (fs.existsSync(backup)) {
            fs.rmSync(backup, { force: true });
        }
    } catch (e) {}
    fs.renameSync(target, backup);
    try {
        fs.renameSync(next, target);
        fs.chmodSync(target, 0o755);
    } catch (e) {
        // 回滚
        try {
            fs.renameSync(backup, target);
        } catch (e2) {}
        throw e;
    }
    if (!isNoRelaunch()) {
        const child = spawn(target, [], {
            detached: true,
            stdio: "ignore",
        });
        child.unref();
    }
    return {
        message: "AppImage replaced",
        restartRequired: !isNoRelaunch(),
    };
};

const installWindows = (
    asset: UpdaterAsset,
    downloaded: string,
): InstallResult => {
    if (asset.kind === "setup") {
        // electron-builder NSIS: /S 静默安装，--updated 走更新流程（等应用退出、
        // 结束残留实例），--force-run 让静默安装完成后自动重启新版本。
        const child = spawn(downloaded, ["/S", "--updated", "--force-run"], {
            detached: true,
            stdio: "ignore",
            windowsHide: true,
        });
        child.unref();
        return {
            message: "installer started",
            restartRequired: true,
        };
    }
    // portable / exe：等待当前进程退出后替换 exe
    const target = process.env.AIGCPANEL_UPDATE_TARGET || process.execPath;
    ensureDir(target);
    const next = target + ".new";
    copyFile(downloaded, next, 0o755);
    const script = path.join(
        os.tmpdir(),
        `aigcpanel-update-${process.pid}.bat`,
    );
    const body =
        "@echo off\r\n" +
        "setlocal\r\n" +
        ":wait\r\n" +
        `tasklist /FI "PID eq ${process.pid}" 2>NUL | find "${process.pid}" >NUL\r\n` +
        "if not errorlevel 1 (\r\n" +
        "  timeout /t 1 /nobreak >NUL\r\n" +
        "  goto wait\r\n" +
        ")\r\n" +
        `move /Y "${target}" "${target}.old" >NUL\r\n` +
        `move /Y "${next}" "${target}" >NUL\r\n` +
        `if not "%AIGCPANEL_UPDATE_NO_RELAUNCH%"=="1" start "" "${target}"\r\n` +
        'del "%~f0"\r\n' +
        "exit /b 0\r\n";
    fs.writeFileSync(script, body, "utf8");
    const child = spawn("cmd", ["/c", script], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
    });
    child.unref();
    return {
        message: "executable will be replaced after exit",
        restartRequired: !isNoRelaunch(),
    };
};

const installMac = (asset: UpdaterAsset, downloaded: string): InstallResult => {
    const target = currentAppBundle();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aigcpanel-update-"));
    let newApp: string;
    if (asset.kind === "zip") {
        execFileSync("ditto", ["-x", "-k", downloaded, tmpDir], {
            stdio: "ignore",
        });
        const found = findAppBundle(tmpDir);
        if (!found) {
            throw new Error("UPDATE_BUNDLE_NOT_FOUND");
        }
        newApp = found;
    } else if (asset.kind === "dmg") {
        // dmg 在 helper 里挂载，这里只记录路径
        newApp = "";
    } else {
        throw new Error("UNSUPPORTED_PACKAGE");
    }
    const script = path.join(tmpDir, "apply.sh");
    const relaunch = isNoRelaunch() ? "" : `open ${shellQuote(target)}`;
    let body = "#!/bin/sh\nset -e\n";
    body += `while kill -0 ${process.pid} 2>/dev/null; do sleep 0.2; done\n`;
    if (asset.kind === "zip") {
        body += `rm -rf ${shellQuote(target)}\n`;
        body += `cp -R ${shellQuote(newApp)} ${shellQuote(target)}\n`;
        body += `xattr -dr com.apple.quarantine ${shellQuote(target)} 2>/dev/null || true\n`;
    } else {
        const mountPoint = path.join(tmpDir, "mnt");
        body += `mkdir -p ${shellQuote(mountPoint)}\n`;
        body += `hdiutil attach -nobrowse -noautoopen ${shellQuote(downloaded)} -mountpoint ${shellQuote(mountPoint)}\n`;
        body += `APP_SRC=$(find ${shellQuote(mountPoint)} -maxdepth 1 -name '*.app' | head -1)\n`;
        body += `rm -rf ${shellQuote(target)}\n`;
        body += `cp -R "$APP_SRC" ${shellQuote(target)}\n`;
        body += `hdiutil detach ${shellQuote(mountPoint)} -quiet || true\n`;
        body += `xattr -dr com.apple.quarantine ${shellQuote(target)} 2>/dev/null || true\n`;
    }
    if (relaunch) {
        body += relaunch + "\n";
    }
    body += `rm -rf ${shellQuote(tmpDir)}\n`;
    fs.writeFileSync(script, body, "utf8");
    fs.chmodSync(script, 0o755);
    const child = spawn("/bin/sh", [script], {
        detached: true,
        stdio: "ignore",
    });
    child.unref();
    return {
        message: "application will be replaced after exit",
        restartRequired: !isNoRelaunch(),
    };
};

export const installUpdate = (
    asset: UpdaterAsset,
    downloaded: string,
): InstallResult => {
    if (!downloaded || !fs.existsSync(downloaded)) {
        throw new Error("UPDATE_FILE_NOT_FOUND");
    }
    if (process.platform === "linux") {
        return installLinux(asset, downloaded);
    }
    if (process.platform === "win32") {
        return installWindows(asset, downloaded);
    }
    if (process.platform === "darwin") {
        return installMac(asset, downloaded);
    }
    throw new Error("UNSUPPORTED_PLATFORM");
};
