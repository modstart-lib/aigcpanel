import os from "node:os";
import path from "node:path";

export type ClientConfig = {
    /**
     * 数据目录根路径。为 undefined 时表示未配置，
     * 主进程回退使用 Electron 默认 userData（app.getPath("userData")）。
     */
    dataPath?: string;
};

/**
 * 展开路径开头的 `~`，仅当 `~` 位于路径最前面时处理。
 * - "~"           → os.homedir()
 * - "~/xxx"       → <home>/xxx
 * - "/abs/path"   → 原样返回
 */
const expandHome = (value: string): string => {
    if (value === "~") {
        return os.homedir();
    }
    if (value.startsWith("~/") || value.startsWith(`~${path.sep}`)) {
        return path.join(os.homedir(), value.slice(2));
    }
    return value;
};

/**
 * 读取客户端配置，确定数据目录根路径。
 *
 * 优先级（与 test/clientConfig.ts 的 getAigcpanelDataRoot() 保持一致）：
 *   1. AIGCPANEL_DATA_ROOT 环境变量（有值，trim 后非空，支持 ~ 展开）
 *      —— 由正式安装版 macOS Info.plist 的 LSEnvironment 注入，
 *         用于把正式使用数据隔离到独立目录，避免被开发测试的种子数据破坏
 *   2. 未设置 / 空值 → 返回空配置，主进程回退使用 Electron 默认 userData
 *
 * 说明：本仓库当前没有 client.json dataPath 机制（应用数据统一存放在
 * Electron userData 目录），因此该级优先级暂不存在，后续如需新增只需
 * 在本函数中环境变量判断之后补充读取逻辑即可。
 */
export const loadClientConfig = (): ClientConfig => {
    const envDataRoot = process.env.AIGCPANEL_DATA_ROOT;
    if (envDataRoot && envDataRoot.trim()) {
        return {
            dataPath: path.resolve(expandHome(envDataRoot.trim())),
        };
    }
    return {};
};
