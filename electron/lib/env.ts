import chardet from "chardet";
import { execSync } from "child_process";
import iconv from "iconv-lite";
import { resolve } from "node:path";
import fs from "node:fs";
import os from "os";
import { Log } from "../mapi/log";
import FileIndex from "../mapi/file";

export const isPackaged = ["true"].includes(process.env.IS_PACKAGED);

export const isDev = !isPackaged;

export const isWin = process.platform === "win32";

export const isMac = process.platform === "darwin";

export const isLinux = process.platform === "linux";

export const isMain = process.type === "browser";

export const isRender = process.type === "renderer";

export const platformName = (): "win" | "osx" | "linux" | null => {
    if (isWin) return "win";
    if (isMac) return "osx";
    if (isLinux) return "linux";
    return null;
};

export const memoryInfo = () => {
    return {
        total: os.totalmem(),
        free: os.freemem(),
    };
};

// Decode raw command output bytes into a readable UTF-8 string.
// Windows command output (such as cmd.exe error messages) is usually encoded
// with the local ANSI code page (GBK / cp936), which shows as garbled text
// when it is interpreted as UTF-8.
const outputToUtf8 = (data: string | Buffer | null | undefined): string => {
    if (!data) {
        return "";
    }
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, "binary");
    if (!isWin) {
        return buffer.toString("utf8");
    }
    const detected = chardet.detect(buffer);
    if (detected && /utf-?8/i.test(detected)) {
        return buffer.toString("utf8");
    }
    return iconv.decode(buffer, "cp936");
};

// Run a command and return its UTF-8 stdout.
// stderr is captured instead of being forwarded to the parent process, so a
// failing probe command never leaks a garbled message into the console.
const execCommand = (command: string): string => {
    const stdout = execSync(command, {
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "binary",
    }) as unknown as string;
    return outputToUtf8(stdout);
};

// Resolve a file under %SystemRoot%\System32. SystemRoot is used so systems
// installed outside C:\Windows still resolve correctly.
const winSystem32File = (...parts: string[]): string => {
    const root = process.env.SystemRoot || process.env.windir || "C:\\Windows";
    return resolve(root, "System32", ...parts);
};

// WMIC is deprecated (since Windows 10 21H1) and is no longer installed by
// default on newer Windows (Windows 11 24H2 and later). Whether it exists
// depends on the edition and on optional features, so detect it by file
// before running it instead of running it and handling the failure.
let wmicPathCache: string | null | undefined;
const wmicPath = (): string | null => {
    if (undefined === wmicPathCache) {
        const candidate = winSystem32File("wbem", "wmic.exe");
        wmicPathCache = fs.existsSync(candidate) ? candidate : null;
    }
    return wmicPathCache;
};

// powershell.exe ships with every supported Windows version; resolve it to an
// absolute path so the fallback never depends on PATH.
let powershellPathCache: string | null | undefined;
const powershellPath = (): string | null => {
    if (undefined === powershellPathCache) {
        const candidate = winSystem32File(
            "WindowsPowerShell",
            "v1.0",
            "powershell.exe",
        );
        powershellPathCache = fs.existsSync(candidate) ? candidate : null;
    }
    return powershellPathCache;
};

const tryFirst = (functionList: (() => any)[]) => {
    for (const fun of functionList) {
        try {
            return fun();
        } catch (e: any) {
            // A candidate probe may still fail at runtime (for example a
            // transient execution error). This is tolerated, so record a
            // single info line instead of treating the raw command error as
            // an error.
            const reason = outputToUtf8(e?.stderr || e?.message || "")
                .trim()
                .split("\n")[0];
            Log.info("env.command.skip", reason || null);
        }
    }
    return null;
};

let platformVersionCache: string | null = null;
export const platformVersion = () => {
    if (null === platformVersionCache) {
        const functionList: any[] = [];
        if (isWin) {
            // os.release() returns the same Windows NT version that
            // `wmic os get Version` used to report (e.g. "10.0.19045"), so no
            // external command is needed at all.
            functionList.push(() => os.release().trim());
            // Fallback: read the registry ReleaseId (e.g. "22H2") when
            // os.release() is unexpectedly empty.
            const ps = powershellPath();
            if (ps) {
                functionList.push(() =>
                    execCommand(
                        `"${ps}" -command "(Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion').ReleaseId"`,
                    ).trim(),
                );
            }
        } else if (isMac) {
            functionList.push(() =>
                execCommand("sw_vers -productVersion").trim(),
            );
        } else if (isLinux) {
            functionList.push(() =>
                execCommand("cat /etc/os-release | grep VERSION_ID")
                    .split("=")[1]
                    .trim()
                    .replace(/"/g, ""),
            );
        }
        platformVersionCache = tryFirst(functionList);
        if (!platformVersionCache) {
            Log.error("env.platformVersion.error");
            platformVersionCache = "0.0.0";
        }
    }
    return platformVersionCache;
};

export const platformArch = (): "x86" | "arm64" | null => {
    switch (os.arch()) {
        case "x64":
            return "x86";
        case "arm64":
            return "arm64";
    }
    return null;
};

let platformUUIDCache: string | null = null;
export const platformUUID = () => {
    if (null === platformUUIDCache) {
        const functionList: any[] = [];
        if (isWin) {
            // WMIC is used when present (fast), otherwise it is skipped
            // entirely instead of being attempted and failing.
            const wmic = wmicPath();
            if (wmic) {
                functionList.push(() =>
                    execCommand(`"${wmic}" csproduct get UUID`)
                        .split("\n")[1]
                        .trim(),
                );
            }
            const ps = powershellPath();
            if (ps) {
                functionList.push(() =>
                    execCommand(
                        `"${ps}" -command "(Get-CimInstance Win32_ComputerSystemProduct).UUID"`,
                    ).trim(),
                );
            }
        } else if (isMac) {
            functionList.push(() =>
                execCommand("system_profiler SPHardwareDataType | grep UUID")
                    .split(": ")[1]
                    .trim(),
            );
        } else if (isLinux) {
            functionList.push(() =>
                execCommand("cat /var/lib/dbus/machine-id")
                    .trim()
                    .toUpperCase(),
            );
        }
        platformUUIDCache = tryFirst(functionList);
        if (!platformUUIDCache) {
            Log.error("env.platformUUID.error");
            platformUUIDCache = "000000";
        }
    }
    return platformUUIDCache;
};

export const buildResolve = (value: string): string => {
    return resolve(`electron/resources/build/${value}`);
};

export const binResolve = (value: string): string => {
    return resolve(process.resourcesPath, "bin", value);
};

export const extraResolve = (filePath: string): string => {
    const basePath = isPackaged ? process.resourcesPath : "electron/resources";
    return resolve(basePath, "extra", filePath);
};

export const extraResolveWithPlatform = (filePath: string): string => {
    const dir = [platformName(), platformArch()].join("-");
    const p = [dir, filePath].join("/");
    return extraResolve(p);
};

export const extraResolveBin = (filePath: string): string => {
    if (isWin) {
        if (!filePath.endsWith(".exe")) {
            filePath += ".exe";
        }
    }
    const dir = [platformName(), platformArch()].join("-");
    const p = [dir, filePath].join("/");
    const binaryPath = extraResolve(p);
    if (!fs.existsSync(binaryPath)) {
        throw new Error(`Binary file not found: ${binaryPath}`);
    }
    return binaryPath;
};
