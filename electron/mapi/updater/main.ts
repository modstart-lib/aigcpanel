import { app, ipcMain } from "electron";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { AppConfig } from "../../../src/config";
import {
    platformArch,
    platformName,
    platformUUID,
    platformVersion,
} from "../../lib/env";
import { AppEnv } from "../env";
import { Events } from "../event/main";
import ConfigMain from "../config/main";
import DBMain from "../db/main";
import Log from "../log/main";
import Apps from "../app/index";
import { ServerMain } from "../server/main";
import {
    canAutoInstallAsset,
    isNewerVersion,
    isValidVersion,
    normalizeVersion,
    pickAsset,
    type UpdaterAsset,
    type UpdaterBlocker,
    type UpdaterDownloadChannel,
    type UpdaterRelease,
    type UpdaterState,
} from "./index";
import { installUpdate } from "./install";

const currentVersion = () =>
    process.env.AIGCPANEL_UPDATE_CURRENT_VERSION || AppConfig.version;

const updateEndpoint = () =>
    process.env.AIGCPANEL_UPDATE_ENDPOINT || AppConfig.updaterUrl;

const initialState = (): UpdaterState => ({
    phase: "idle",
    currentVersion: currentVersion(),
    latestVersion: "",
    release: null,
    asset: null,
    channels: [],
    channel: null,
    progress: 0,
    downloaded: 0,
    total: 0,
    resumedBytes: 0,
    speed: 0,
    filePath: "",
    error: "",
    blockers: [],
    canAutoInstall: false,
    updatedAt: new Date().toISOString(),
});

let state: UpdaterState = initialState();
let checkAbort: AbortController | null = null;
let activeRequest: http.ClientRequest | null = null;
let activeResponse: http.IncomingMessage | null = null;
let cancelRequested = false;
let lastProgressAt = 0;
let lastProgressBytes = 0;
let lastProgressTime = 0;

const broadcastState = () => {
    try {
        Events.broadcast("UpdaterState", state);
    } catch (e) {
        // 窗口未就绪时忽略
    }
};

const setState = (patch: Partial<UpdaterState>) => {
    state = {
        ...state,
        ...patch,
        updatedAt: new Date().toISOString(),
    };
    broadcastState();
};

const fail = (message: string) => {
    setState({
        phase: "failed",
        error: message,
        speed: 0,
    });
};

const headersForRequest = () => ({
    "User-Agent": Apps.getUserAgent(),
    "Content-Type": "application/json",
});

/**
 * 检查更新。请求失败时保持 failed 状态并把错误交给前端。
 */
const check = async (): Promise<UpdaterState> => {
    // 下载/安装进行中时，任何检查都不应重置状态
    if (["downloading", "installing", "restarting"].includes(state.phase)) {
        return state;
    }
    if (checkAbort) {
        checkAbort.abort();
    }
    const previous = state;
    checkAbort = new AbortController();
    setState({
        phase: "checking",
        error: "",
        blockers: [],
        progress: 0,
        downloaded: 0,
        total: 0,
        resumedBytes: 0,
        speed: 0,
        filePath: previous.phase === "ready" ? previous.filePath : "",
        channel: null,
    });
    try {
        const res = await fetch(updateEndpoint(), {
            method: "POST",
            headers: headersForRequest(),
            body: JSON.stringify({
                version: currentVersion(),
                uuid: platformUUID(),
                platform: {
                    name: platformName(),
                    version: platformVersion(),
                    arch: platformArch(),
                },
            }),
            signal: checkAbort.signal,
        });
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        const json: any = await res.json();
        if (!json || json.code !== 0) {
            throw new Error((json && json.msg) || "UPDATE_CHECK_FAILED");
        }
        const release = (json.data || {}) as UpdaterRelease;
        const latest = normalizeVersion(release.version || "");
        let update = release.update === true;
        if (
            !update &&
            isValidVersion(latest) &&
            isValidVersion(currentVersion())
        ) {
            update = isNewerVersion(latest, currentVersion());
        }
        const assets = Array.isArray(release.assets) ? release.assets : [];
        const asset = pickAsset(assets);
        let channels: UpdaterDownloadChannel[] = [];
        if (asset && Array.isArray(asset.downloads) && asset.downloads.length) {
            channels = asset.downloads;
        } else if (Array.isArray(release.channels)) {
            channels = release.channels;
        } else if (asset && Array.isArray(asset.urls)) {
            channels = asset.urls.map((url) => ({ title: url, url }));
        }
        const keepReady =
            update &&
            previous.phase === "ready" &&
            previous.latestVersion === latest &&
            !!previous.filePath &&
            fs.existsSync(previous.filePath);
        setState({
            phase: keepReady ? "ready" : update ? "available" : "up-to-date",
            latestVersion: latest,
            release,
            asset: asset || null,
            channels,
            canAutoInstall: !!asset && canAutoInstallAsset(asset),
            error: "",
            filePath: keepReady ? previous.filePath : "",
            progress: keepReady ? 100 : 0,
            downloaded: keepReady ? previous.downloaded : 0,
            total: keepReady ? previous.total : 0,
            resumedBytes: keepReady ? previous.resumedBytes : 0,
            speed: 0,
        });
    } catch (e: any) {
        if (e && e.name === "AbortError") {
            return state;
        }
        Log.error("updater.check.error", e);
        fail(e && e.message ? e.message : "UPDATE_CHECK_FAILED");
    }
    return state;
};

/**
 * 让 http(s) 请求跟随重定向。
 * headers 会透传给重定向后的请求（Range 续传需要）。
 */
const requestStream = (
    url: string,
    headers: Record<string, string> = {},
    redirects = 0,
): Promise<http.IncomingMessage> => {
    return new Promise((resolve, reject) => {
        let parsed: URL;
        try {
            parsed = new URL(url);
        } catch (e) {
            reject(new Error("INVALID_URL"));
            return;
        }
        const mod = parsed.protocol === "https:" ? https : http;
        const req = mod.get(
            url,
            {
                headers: {
                    "User-Agent": Apps.getUserAgent(),
                    "Accept-Encoding": "identity",
                    ...headers,
                },
            },
            (res) => {
                const status = res.statusCode || 0;
                if (
                    [301, 302, 303, 307, 308].includes(status) &&
                    res.headers.location &&
                    redirects < 8
                ) {
                    res.resume();
                    resolve(
                        requestStream(
                            new URL(res.headers.location, url).toString(),
                            headers,
                            redirects + 1,
                        ),
                    );
                    return;
                }
                if (status !== 200 && status !== 206 && status !== 416) {
                    res.resume();
                    reject(new Error(`HTTP ${status}`));
                    return;
                }
                activeResponse = res;
                resolve(res);
            },
        );
        activeRequest = req;
        req.setTimeout(60 * 1000, () => {
            req.destroy(new Error("DOWNLOAD_TIMEOUT"));
        });
        req.on("error", (err) => {
            activeRequest = null;
            reject(err);
        });
    });
};

const sha256FileHex = (filePath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash("sha256");
        const stream = fs.createReadStream(filePath);
        stream.on("data", (chunk) => hash.update(chunk));
        stream.on("end", () => resolve(hash.digest("hex")));
        stream.on("error", reject);
    });
};

/**
 * 校验并激活 .part 文件。
 * 尺寸不足时保留 .part 供后续续传；哈希不匹配时删除损坏文件。
 */
const finalizePart = async (
    part: string,
    dest: string,
    asset: UpdaterAsset,
    downloaded: number,
    url: string,
): Promise<string> => {
    if (asset.size > 0 && downloaded !== asset.size) {
        if (downloaded > asset.size) {
            fs.rmSync(part, { force: true });
        }
        throw new Error(`SIZE_MISMATCH:${downloaded}:${asset.size}`);
    }
    if (asset.sha256) {
        const got = (await sha256FileHex(part)).toLowerCase();
        if (got !== asset.sha256.toLowerCase()) {
            fs.rmSync(part, { force: true });
            throw new Error(`SHA256_MISMATCH:${got}:${asset.sha256}`);
        }
    } else {
        // 没有哈希时不允许自动安装，但下载仍可用于手动安装
        Log.info("updater.download.unverified", { url, name: asset.name });
    }
    if (fs.existsSync(dest)) {
        fs.rmSync(dest, { force: true });
    }
    fs.renameSync(part, dest);
    return dest;
};

/**
 * 下载单个 URL，支持 HTTP Range 断点续传。
 *
 * - .part 已存在时从已有字节继续（Range: bytes=N-）
 * - 镜像忽略 Range 返回 200 时自动从头覆盖
 * - 网络中断保留 .part，下一次下载/下一个通道继续续传
 * - 校验通过后改名到最终文件
 */
const downloadOnce = async (
    url: string,
    dest: string,
    asset: UpdaterAsset,
): Promise<{ path: string; resumed: number }> => {
    const part = dest + ".part";
    let existing = 0;
    try {
        if (fs.existsSync(part)) {
            existing = fs.statSync(part).size;
        }
    } catch (e) {
        existing = 0;
    }
    if (asset.size > 0 && existing > asset.size) {
        fs.rmSync(part, { force: true });
        existing = 0;
    }
    if (asset.size > 0 && existing === asset.size) {
        try {
            const path = await finalizePart(part, dest, asset, existing, url);
            return { path, resumed: existing };
        } catch (e) {
            existing = 0;
        }
    }

    const headers: Record<string, string> = {};
    if (existing > 0) {
        headers["Range"] = `bytes=${existing}-`;
    }
    const res = await requestStream(url, headers);
    let start = existing;
    const status = res.statusCode || 200;

    if (status === 416) {
        res.resume();
        activeRequest = null;
        activeResponse = null;
        try {
            const path = await finalizePart(part, dest, asset, existing, url);
            return { path, resumed: existing };
        } catch (e) {
            fs.rmSync(part, { force: true });
            throw new Error("RANGE_NOT_SATISFIABLE");
        }
    }
    if (status === 200 && existing > 0) {
        // 镜像忽略了 Range，只能从头开始
        start = 0;
    }
    if (start > 0) {
        const contentRange = String(res.headers["content-range"] || "");
        const match = /^bytes\s+(\d+)-/i.exec(contentRange);
        if (match && parseInt(match[1], 10) !== start) {
            start = 0;
        }
    }
    const contentLength = Number(res.headers["content-length"] || 0);
    const total = asset.size || (contentLength ? contentLength + start : 0);
    const file = fs.createWriteStream(part, {
        flags: start > 0 ? "a" : "w",
    });
    let downloaded = start;
    lastProgressAt = 0;
    lastProgressBytes = start;
    lastProgressTime = Date.now();
    setState({
        phase: "downloading",
        progress:
            total > 0 ? Math.min(99, Math.floor((start * 100) / total)) : 0,
        downloaded: start,
        total,
        resumedBytes: start,
        speed: 0,
        filePath: "",
        channel: { url },
    });
    try {
        for await (const chunk of res as any) {
            if (cancelRequested) {
                throw new Error("DOWNLOAD_CANCELLED");
            }
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            downloaded += buffer.length;
            if (!file.write(buffer)) {
                await new Promise((resolve) => file.once("drain", resolve));
            }
            const now = Date.now();
            if (now - lastProgressAt >= 200) {
                lastProgressAt = now;
                const elapsed = Math.max(
                    (now - lastProgressTime) / 1000,
                    0.001,
                );
                const speed = (downloaded - lastProgressBytes) / elapsed;
                lastProgressBytes = downloaded;
                lastProgressTime = now;
                setState({
                    downloaded,
                    total: total || downloaded,
                    progress:
                        total > 0
                            ? Math.min(
                                  99,
                                  Math.floor((downloaded * 100) / total),
                              )
                            : 0,
                    speed,
                });
            }
        }
        await new Promise<void>((resolve, reject) => {
            file.end((err?: Error) => (err ? reject(err) : resolve()));
        });
    } catch (e) {
        try {
            file.destroy();
        } catch (e2) {}
        activeRequest = null;
        activeResponse = null;
        // 保留 .part，下一次下载可以继续续传
        throw e;
    }
    activeRequest = null;
    activeResponse = null;

    const path = await finalizePart(part, dest, asset, downloaded, url);
    return { path, resumed: start };
};

const safeFileName = (name: string) => {
    return (name || "update.bin")
        .replace(/[\\/:*?"<>|]/g, "_")
        .replace(/\.\.+/g, ".");
};

const doDownload = async (asset: UpdaterAsset, preferredUrl: string | null) => {
    cancelRequested = false;
    const dir = path.join(AppEnv.dataRoot, "updates");
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, safeFileName(asset.name || "update.bin"));
    const urls: string[] = [];
    const push = (url?: string) => {
        if (url && !urls.includes(url)) {
            urls.push(url);
        }
    };
    push(preferredUrl || undefined);
    (asset.urls || []).forEach(push);
    push(asset.url);
    const errors: string[] = [];
    for (const url of urls) {
        if (cancelRequested) {
            break;
        }
        try {
            const result = await downloadOnce(url, dest, asset);
            setState({
                phase: "ready",
                progress: 100,
                downloaded: asset.size || state.downloaded,
                total: asset.size || state.total,
                resumedBytes: result.resumed,
                speed: 0,
                filePath: result.path,
                error: "",
            });
            return;
        } catch (e: any) {
            if (cancelRequested || (e && e.message === "DOWNLOAD_CANCELLED")) {
                setState({
                    phase: "available",
                    progress: 0,
                    downloaded: 0,
                    resumedBytes: 0,
                    speed: 0,
                    error: "",
                });
                return;
            }
            errors.push(`${url}: ${e && e.message ? e.message : e}`);
        }
    }
    fail(errors.length ? errors.join("; ") : "DOWNLOAD_FAILED");
};

const cancelDownload = () => {
    cancelRequested = true;
    try {
        activeRequest?.destroy(new Error("DOWNLOAD_CANCELLED"));
    } catch (e) {}
    try {
        activeResponse?.destroy();
    } catch (e) {}
    activeRequest = null;
    activeResponse = null;
};

const probe = async (
    channels: UpdaterDownloadChannel[],
): Promise<
    Array<{ title: string; url: string; ok: boolean; latency: number }>
> => {
    const list = Array.isArray(channels) ? channels : [];
    return await Promise.all(
        list.map(async (channel, index) => {
            const started = Date.now();
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 5000);
            const attempt = async (method: "HEAD" | "GET") => {
                const res = await fetch(channel.url, {
                    method,
                    headers:
                        method === "GET" ? { Range: "bytes=0-0" } : undefined,
                    signal: controller.signal,
                });
                // 只探测响应头，不读取响应体
                try {
                    await res.body?.cancel();
                } catch (e) {}
                if (!res.ok && res.status !== 206) {
                    throw new Error(`HTTP ${res.status}`);
                }
            };
            try {
                try {
                    await attempt("HEAD");
                } catch (e) {
                    // 部分镜像不支持 HEAD，用 Range GET 兜底
                    await attempt("GET");
                }
                clearTimeout(timer);
                return {
                    title: channel.title || channel.url,
                    url: channel.url,
                    ok: true,
                    latency: Date.now() - started,
                };
            } catch (e) {
                clearTimeout(timer);
                return {
                    title: channel.title || channel.url,
                    url: channel.url,
                    ok: false,
                    latency: Number.MAX_SAFE_INTEGER - index,
                };
            }
        }),
    );
};

const parentPidOf = (pid: number): number => {
    try {
        if (process.platform === "win32") {
            try {
                const out = execSync(
                    `wmic process where processid=${pid} get parentprocessid`,
                    {
                        encoding: "utf8",
                        timeout: 3000,
                        stdio: ["ignore", "pipe", "ignore"],
                    },
                );
                const nums = out
                    .split(/\s+/)
                    .map((item) => parseInt(item, 10))
                    .filter((item) => !isNaN(item) && item > 0);
                return nums.length ? nums[nums.length - 1] : 0;
            } catch (e) {
                const out = execSync(
                    `powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter \"ProcessId=${pid}\").ParentProcessId"`,
                    {
                        encoding: "utf8",
                        timeout: 5000,
                        stdio: ["ignore", "pipe", "ignore"],
                    },
                );
                return parseInt(out.trim(), 10) || 0;
            }
        }
        const out = execSync(`ps -p ${pid} -o ppid=`, {
            encoding: "utf8",
            timeout: 3000,
            stdio: ["ignore", "pipe", "ignore"],
        }).trim();
        return parseInt(out, 10) || 0;
    } catch (e) {
        return 0;
    }
};

/**
 * 判断进程是否就是当前应用或它的子进程（Electron 的 GPU/renderer 等 helper）。
 * 这些进程会随应用退出，不应作为阻碍程序提示给用户。
 */
const isSelfOrDescendant = (pid: number): boolean => {
    if (pid === process.pid) {
        return true;
    }
    let current = pid;
    for (let i = 0; i < 12; i++) {
        const parent = parentPidOf(current);
        if (!parent || parent === current) {
            return false;
        }
        if (parent === process.pid) {
            return true;
        }
        current = parent;
    }
    return false;
};

/**
 * 查找正在使用安装目标的系统进程（例如 Linux 上仍打开 AppImage 的进程、
 * macOS 上其它实例、Windows 上另一个 AigcPanel 实例）。
 * 这些进程无法由应用自动结束，需要用户退出。
 */
const externalProcessBlockers = (): UpdaterBlocker[] => {
    const blockers: UpdaterBlocker[] = [];
    let bundlePath = "";
    if (process.platform === "darwin") {
        let current = process.execPath;
        for (let i = 0; i < 3; i++) {
            current = path.dirname(current);
        }
        if (current.endsWith(".app")) {
            bundlePath = current;
        }
    }
    const target =
        process.env.AIGCPANEL_UPDATE_TARGET ||
        process.env.APPIMAGE ||
        bundlePath ||
        process.execPath;
    if (!target) {
        return blockers;
    }
    const pids = new Set<number>();
    try {
        if (process.platform === "win32") {
            const image = path.basename(target);
            const out = execSync(
                `tasklist /FI "IMAGENAME eq ${image}" /FO CSV /NH`,
                { encoding: "utf8", timeout: 5000 },
            );
            for (const line of out.split(/\r?\n/)) {
                const match = /^"[^"]+","(\d+)"/.exec(line.trim());
                if (match) {
                    pids.add(parseInt(match[1], 10));
                }
            }
        } else if (process.platform === "darwin" && bundlePath) {
            // 用 bundle 路径匹配命令行，排除 Electron 自己的 helper 进程
            const quoted = `'${bundlePath.replace(/'/g, "'\\''")}'`;
            try {
                const out = execSync(`pgrep -f ${quoted}`, {
                    encoding: "utf8",
                    timeout: 5000,
                    stdio: ["ignore", "pipe", "ignore"],
                });
                out.split(/\s+/)
                    .filter(Boolean)
                    .forEach((pid) => pids.add(parseInt(pid, 10)));
            } catch (e) {}
        } else {
            const quoted = `'${target.replace(/'/g, "'\\''")}'`;
            try {
                const out = execSync(`lsof -t ${quoted}`, {
                    encoding: "utf8",
                    timeout: 5000,
                    stdio: ["ignore", "pipe", "ignore"],
                });
                out.split(/\s+/)
                    .filter(Boolean)
                    .forEach((pid) => pids.add(parseInt(pid, 10)));
            } catch (e) {
                // lsof 没有匹配结果时返回非 0，忽略
            }
            if (pids.size === 0) {
                try {
                    const out = execSync(`fuser ${quoted} 2>/dev/null`, {
                        encoding: "utf8",
                        timeout: 5000,
                        stdio: ["ignore", "pipe", "ignore"],
                    });
                    out.split(/\s+/)
                        .filter(Boolean)
                        .forEach((pid) => pids.add(parseInt(pid, 10)));
                } catch (e) {}
            }
        }
    } catch (e) {
        return blockers;
    }
    for (const pid of pids) {
        if (!pid || isSelfOrDescendant(pid)) {
            continue;
        }
        let name = `PID ${pid}`;
        try {
            if (process.platform === "win32") {
                name = path.basename(target);
            } else {
                const out = execSync(`ps -p ${pid} -o comm=`, {
                    encoding: "utf8",
                    timeout: 3000,
                    stdio: ["ignore", "pipe", "ignore"],
                }).trim();
                if (out) {
                    name = out;
                }
            }
        } catch (e) {}
        blockers.push({
            type: "app",
            id: String(pid),
            name,
            detail: target,
        });
    }
    return blockers;
};

/**
 * 运行中的业务任务（视频/语音/工作流等）。
 * 任务由渲染进程调度，这里直接读共享 SQLite，重启前提示用户先停止/等待完成。
 */
const activeTaskBlockers = async (): Promise<UpdaterBlocker[]> => {
    try {
        const tasks = await DBMain.select(
            `SELECT id, biz, title, status FROM data_task
             WHERE status IN ('queue', 'wait', 'running')
             ORDER BY id DESC LIMIT 50`,
        );
        return (tasks || []).map((task: any) => ({
            type: "task" as const,
            id: String(task.id),
            name: task.title || `${task.biz || "Task"} #${task.id}`,
            detail: task.status,
        }));
    } catch (e) {
        // data_task 表尚未创建或数据库未就绪时忽略
        return [];
    }
};

/**
 * 重启前检查：本地模型服务、运行中的业务任务、由本应用启动的子进程、
 * 占用安装目标的系统进程。
 */
const preflight = async (): Promise<UpdaterBlocker[]> => {
    const blockers: UpdaterBlocker[] = [];
    try {
        const servers = await ServerMain.getRunningServerInfos();
        for (const server of servers) {
            blockers.push({
                type: "server",
                id: server.localPath,
                name: server.name,
                detail: server.version,
            });
        }
    } catch (e) {
        Log.error("updater.preflight.server.error", e);
    }
    try {
        const processes = Apps.runningProcesses();
        for (const proc of processes) {
            blockers.push({
                type: "process",
                id: String(proc.pid),
                name: proc.label || proc.command,
                detail: proc.command,
            });
        }
    } catch (e) {
        Log.error("updater.preflight.process.error", e);
    }
    try {
        const tasks = await activeTaskBlockers();
        for (const task of tasks) {
            blockers.push(task);
        }
    } catch (e) {
        Log.error("updater.preflight.task.error", e);
    }
    const external = externalProcessBlockers();
    const known = new Set(blockers.map((item) => item.id));
    for (const item of external) {
        if (!known.has(item.id)) {
            blockers.push(item);
        }
    }
    return blockers;
};

const stopBlockers = async () => {
    try {
        await ServerMain.stopAllServers();
    } catch (e) {
        Log.error("updater.stopBlockers.server.error", e);
    }
    try {
        Apps.stopAllChildren();
    } catch (e) {
        Log.error("updater.stopBlockers.process.error", e);
    }
    return await preflight();
};

ipcMain.handle("updater:getCheckAtLaunch", async () => {
    return ConfigMain.get("updaterCheckAtLaunch", "yes");
});

ipcMain.handle("updater:setCheckAtLaunch", async (event, value) => {
    return ConfigMain.set("updaterCheckAtLaunch", value);
});

ipcMain.handle("updater:getState", async () => state);

ipcMain.handle("updater:check", async () => check());

ipcMain.handle("updater:probe", async (event, channels) => probe(channels));

ipcMain.handle(
    "updater:download",
    async (
        event,
        payload?: {
            url?: string;
            asset?: UpdaterAsset;
        },
    ) => {
        if (state.phase === "downloading") {
            throw new Error("DOWNLOAD_IN_PROGRESS");
        }
        const asset = payload && payload.asset ? payload.asset : state.asset;
        if (!asset) {
            throw new Error("NO_ASSET");
        }
        if (payload && payload.asset) {
            setState({
                asset,
                canAutoInstall: canAutoInstallAsset(asset),
            });
        }
        void doDownload(asset, (payload && payload.url) || null);
        return state;
    },
);

ipcMain.handle("updater:cancelDownload", async () => {
    cancelDownload();
    return state;
});

ipcMain.handle("updater:preflight", async () => {
    const blockers = await preflight();
    setState({ blockers });
    return blockers;
});

ipcMain.handle("updater:stopBlockers", async () => {
    const blockers = await stopBlockers();
    setState({ blockers });
    return blockers;
});

ipcMain.handle("updater:install", async () => {
    const blockers = await preflight();
    setState({ blockers });
    if (blockers.length > 0) {
        return {
            ok: false,
            error: "BLOCKED",
            blockers,
            state,
        };
    }
    const asset = state.asset;
    if (!asset || !state.filePath) {
        return {
            ok: false,
            error: "NO_DOWNLOAD",
            blockers: [],
            state,
        };
    }
    if (!canAutoInstallAsset(asset)) {
        return {
            ok: false,
            error: "UNSUPPORTED_PACKAGE",
            blockers: [],
            state,
        };
    }
    setState({ phase: "installing", error: "" });
    try {
        const result = installUpdate(asset, state.filePath);
        if (result.restartRequired) {
            setState({ phase: "restarting" });
            // 跳过 before-quit 的本地服务检查：预检已经通过
            (app as any).updateQuit = true;
            (app as any).quitForce = true;
            setTimeout(() => app.quit(), 800);
        } else {
            setState({ phase: "ready", progress: 100 });
        }
        return {
            ok: true,
            result,
            blockers: [],
            state,
        };
    } catch (e: any) {
        const message = e && e.message ? e.message : "INSTALL_FAILED";
        fail(message);
        return {
            ok: false,
            error: message,
            blockers: [],
            state,
        };
    }
});

ipcMain.handle("updater:openDownloadedFile", async () => {
    if (!state.filePath) {
        return false;
    }
    const { shell } = await import("electron");
    await shell.openPath(state.filePath);
    return true;
});

ipcMain.handle("updater:openDownloadPage", async () => {
    const { shell } = await import("electron");
    const url = (state.release && state.release.url) || AppConfig.downloadUrl;
    await shell.openExternal(url);
    return true;
});

export const UpdaterMain = {
    check,
    getState: () => state,
    preflight,
    stopBlockers,
};

export default UpdaterMain;
