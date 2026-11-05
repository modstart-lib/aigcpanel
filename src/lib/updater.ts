/**
 * 更新模块共享逻辑（主进程 / 渲染进程都可使用，不能引用 Node/Electron 模块）。
 */

export type UpdaterPhase =
    | "idle"
    | "checking"
    | "available"
    | "downloading"
    | "ready"
    | "installing"
    | "restarting"
    | "up-to-date"
    | "failed";

export type UpdaterDownloadChannel = {
    title: string;
    url: string;
};

export type UpdaterAsset = {
    env: string;
    os: string;
    arch: string;
    kind: string;
    name: string;
    size: number;
    sha256: string;
    url: string;
    urls?: string[];
    downloads?: UpdaterDownloadChannel[];
    tag?: string;
};

export type UpdaterRelease = {
    name?: string | null;
    version: string;
    versionRemark?: string | null;
    time?: string | null;
    feature?: string | null;
    summary?: string | null;
    notes?: string | null;
    url?: string;
    update: boolean;
    currentVersion?: string;
    platform?: {
        name: string;
        arch: string;
        env: string | null;
    };
    assets: UpdaterAsset[];
    asset?: UpdaterAsset | null;
    channels?: UpdaterDownloadChannel[];
};

export type UpdaterBlocker = {
    type: "server" | "process" | "app";
    id?: string;
    name: string;
    detail?: string;
};

export type UpdaterState = {
    phase: UpdaterPhase;
    currentVersion: string;
    latestVersion: string;
    release: UpdaterRelease | null;
    asset: UpdaterAsset | null;
    channels: UpdaterDownloadChannel[];
    /** 前端测速后选中的通道 */
    channel: {
        title?: string;
        url: string;
        latency?: number;
    } | null;
    progress: number;
    downloaded: number;
    total: number;
    /** 本次下载开始时从 .part 文件续传的字节数 */
    resumedBytes: number;
    /** bytes per second */
    speed: number;
    filePath: string;
    error: string;
    blockers: UpdaterBlocker[];
    /** 当前平台是否支持自动安装（有 sha256 且资产类型可处理） */
    canAutoInstall: boolean;
    updatedAt: string;
};

export type VersionParts = {
    major: number;
    minor: number;
    patch: number;
    prerelease: string[];
    original: string;
};

/**
 * 解析语义化版本，支持 0.2.0 / 0.2.0-beta / 0.2.0-beta.1 / v2.7.0。
 */
export const parseVersion = (version: string): VersionParts | null => {
    if (typeof version !== "string") {
        return null;
    }
    let v = version.trim();
    if (!v) {
        return null;
    }
    if (v[0] === "v" || v[0] === "V") {
        v = v.substring(1);
    }
    const plus = v.indexOf("+");
    if (plus >= 0) {
        v = v.substring(0, plus);
    }
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(v);
    if (!match) {
        return null;
    }
    return {
        major: parseInt(match[1], 10),
        minor: parseInt(match[2], 10),
        patch: parseInt(match[3], 10),
        prerelease: match[4] ? match[4].split(".") : [],
        original: v,
    };
};

export const normalizeVersion = (version: string): string => {
    const parsed = parseVersion(version);
    return parsed ? parsed.original : String(version || "").trim();
};

export const isValidVersion = (version: string): boolean =>
    parseVersion(version) !== null;

const comparePrerelease = (a: string[], b: string[]): number => {
    if (a.length === 0 && b.length === 0) {
        return 0;
    }
    // 没有预发布标识的版本更大
    if (a.length === 0) {
        return 1;
    }
    if (b.length === 0) {
        return -1;
    }
    const count = Math.max(a.length, b.length);
    for (let i = 0; i < count; i++) {
        const x = a[i];
        const y = b[i];
        if (x === undefined) {
            return -1;
        }
        if (y === undefined) {
            return 1;
        }
        const xNumeric = /^\d+$/.test(x);
        const yNumeric = /^\d+$/.test(y);
        if (xNumeric && yNumeric) {
            const diff = parseInt(x, 10) - parseInt(y, 10);
            if (diff !== 0) {
                return diff > 0 ? 1 : -1;
            }
            continue;
        }
        if (xNumeric && !yNumeric) {
            return -1;
        }
        if (!xNumeric && yNumeric) {
            return 1;
        }
        if (x > y) {
            return 1;
        }
        if (x < y) {
            return -1;
        }
    }
    return 0;
};

/**
 * 比较两个版本：a > b 返回 1，a < b 返回 -1。
 */
export const compareVersion = (a: string, b: string): number => {
    const pa = parseVersion(a);
    const pb = parseVersion(b);
    if (!pa && !pb) {
        const sa = String(a || "").trim();
        const sb = String(b || "").trim();
        return sa > sb ? 1 : sa < sb ? -1 : 0;
    }
    if (!pa) {
        return -1;
    }
    if (!pb) {
        return 1;
    }
    if (pa.major !== pb.major) {
        return pa.major > pb.major ? 1 : -1;
    }
    if (pa.minor !== pb.minor) {
        return pa.minor > pb.minor ? 1 : -1;
    }
    if (pa.patch !== pb.patch) {
        return pa.patch > pb.patch ? 1 : -1;
    }
    return comparePrerelease(pa.prerelease, pb.prerelease);
};

export const isNewerVersion = (version: string, current: string): boolean =>
    compareVersion(version, current) > 0;

/**
 * 资产类型排序（数字越小越优先自动安装）。
 */
export const assetKindRank = (os: string, kind: string): number => {
    if (os === "win") {
        return { portable: 1, setup: 2, exe: 3 }[kind] ?? 99;
    }
    if (os === "osx") {
        return { zip: 1, dmg: 2 }[kind] ?? 99;
    }
    if (os === "linux") {
        return { AppImage: 1, deb: 2 }[kind] ?? 99;
    }
    return 99;
};

/**
 * 当前平台能否自动安装该资产。
 */
export const canAutoInstallAsset = (asset: UpdaterAsset | null): boolean => {
    if (!asset || !asset.sha256) {
        return false;
    }
    if (asset.os === "win") {
        return ["portable", "setup", "exe"].includes(asset.kind);
    }
    if (asset.os === "osx") {
        return ["zip", "dmg"].includes(asset.kind);
    }
    if (asset.os === "linux") {
        return asset.kind === "AppImage";
    }
    return false;
};

/**
 * 选择最适合当前平台的资产。
 */
export const pickAsset = (
    assets: UpdaterAsset[] | undefined,
): UpdaterAsset | null => {
    if (!assets || assets.length === 0) {
        return null;
    }
    const sorted = [...assets].sort(
        (a, b) => assetKindRank(a.os, a.kind) - assetKindRank(b.os, b.kind),
    );
    return sorted.find((item) => canAutoInstallAsset(item)) || sorted[0];
};

/**
 * 探测结果排序：成功优先，其次按延迟升序。
 */
export const sortProbeResults = <
    T extends { ok: boolean; latency: number; rank: number },
>(
    results: T[],
): T[] => {
    return [...results].sort((a, b) => {
        if (a.ok !== b.ok) {
            return a.ok ? -1 : 1;
        }
        if (a.ok && a.latency !== b.latency) {
            return a.latency - b.latency;
        }
        return a.rank - b.rank;
    });
};

export const formatBytes = (bytes: number): string => {
    if (!bytes || bytes < 0) {
        return "0 B";
    }
    const units = ["B", "KB", "MB", "GB", "TB"];
    let value = bytes;
    let index = 0;
    while (value >= 1024 && index < units.length - 1) {
        value /= 1024;
        index++;
    }
    return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

export const formatSpeed = (bytesPerSecond: number): string => {
    if (!bytesPerSecond || bytesPerSecond <= 0) {
        return "";
    }
    return `${formatBytes(bytesPerSecond)}/s`;
};

export default {
    parseVersion,
    normalizeVersion,
    isValidVersion,
    compareVersion,
    isNewerVersion,
    assetKindRank,
    canAutoInstallAsset,
    pickAsset,
    sortProbeResults,
    formatBytes,
    formatSpeed,
};
