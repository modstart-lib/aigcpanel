// 权重下载（config.json 的 prepare）体积与磁盘空间计算。
// 保持零依赖（不引 electron / vue），便于 tsx 直接跑单元测试。

// 下载自身之外额外预留的空间比例
export const PREPARE_SPACE_RATIO = 1.1;
// 下载自身之外额外预留的空间（512 MB）
export const PREPARE_SPACE_MARGIN = 512 * 1024 * 1024;

// 下载这个体积的权重实际需要多少剩余空间（含预留）
export const prepareSpaceRequired = (bytes: number): number => {
    if (!bytes || bytes <= 0 || isNaN(bytes)) {
        return 0;
    }
    return Math.ceil(bytes * PREPARE_SPACE_RATIO) + PREPARE_SPACE_MARGIN;
};

// 还差多少体积没下完（用于续传前估算实际需要多少空间）；未知进度按未开始算
export const prepareRemainingBytes = (
    bytes: number,
    percent?: number | null,
): number => {
    if (!bytes || bytes <= 0 || isNaN(bytes)) {
        return 0;
    }
    const value =
        typeof percent === "number" && !isNaN(percent)
            ? Math.min(100, Math.max(0, percent))
            : 0;
    return Math.max(0, Math.ceil(bytes * (1 - value / 100)));
};

// 还差多少空间；空间充足或未知（null / undefined / 查询失败）时返回 0
export const prepareSpaceShortfall = (
    bytes: number,
    freeBytes?: number | null,
): number => {
    if (typeof freeBytes !== "number" || isNaN(freeBytes) || freeBytes < 0) {
        return 0;
    }
    const required = prepareSpaceRequired(bytes);
    if (!required) {
        return 0;
    }
    return Math.max(0, required - freeBytes);
};

// 与模型卡片上一致的体积文案（GB 一位小数，MB/KB 取整）
export const formatPrepareBytes = (bytes?: number | null): string => {
    if (!bytes || bytes <= 0 || isNaN(bytes)) {
        return "";
    }
    const gb = bytes / 1024 ** 3;
    if (gb >= 1) {
        return `${gb.toFixed(1)} GB`;
    }
    const mb = bytes / 1024 ** 2;
    if (mb >= 1) {
        return `${mb.toFixed(0)} MB`;
    }
    return `${(bytes / 1024).toFixed(0)} KB`;
};

// 多个模型的权重体积合计（忽略缺失值）
export const sumPrepareBytes = (
    values: (number | undefined | null)[],
): number => {
    let total = 0;
    for (const value of values) {
        if (typeof value === "number" && !isNaN(value) && value > 0) {
            total += value;
        }
    }
    return total;
};

// 模型权重实际落在哪块盘：相对路径（数据目录下）归为 "data"，绝对路径按盘符/首段目录分组
export const prepareDiskKey = (localPath?: string | null): string => {
    let p = (localPath || "").replace(/\\/g, "/");
    if (!p) {
        return "data";
    }
    if (p.startsWith("ABS://")) {
        p = p.slice("ABS://".length);
    }
    if (!p.startsWith("/")) {
        if (/^[a-zA-Z]:/.test(p)) {
            return p.slice(0, 2).toLowerCase();
        }
        // 相对路径 = 数据目录下的模型
        return "data";
    }
    const first = p.split("/")[1] || "";
    return first ? `/${first}` : "/";
};

export type PrepareDiskUsage = {
    disk: string;
    bytes: number;
    free: number | null;
};

// 按磁盘汇总：最小剩余空间、最大缺口（用于汇总条与确认弹窗）
export const summarizePrepareDisks = (items: PrepareDiskUsage[]) => {
    const byDisk = new Map<string, { bytes: number; free: number | null }>();
    for (const item of items) {
        const current = byDisk.get(item.disk) || { bytes: 0, free: null };
        current.bytes += item.bytes;
        if (typeof item.free === "number") {
            current.free =
                current.free === null
                    ? item.free
                    : Math.min(current.free, item.free);
        }
        byDisk.set(item.disk, current);
    }
    let freeMin: number | null = null;
    let shortfall = 0;
    let shortDisk = "";
    for (const [disk, value] of byDisk) {
        if (typeof value.free === "number") {
            freeMin =
                freeMin === null ? value.free : Math.min(freeMin, value.free);
        }
        const gap = prepareSpaceShortfall(value.bytes, value.free);
        if (gap > shortfall) {
            shortfall = gap;
            shortDisk = disk;
        }
    }
    return { diskCount: byDisk.size, freeMin, shortfall, shortDisk };
};
