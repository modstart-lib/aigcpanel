/**
 * 直播音色云模型解析
 *
 * 云模型只存在于远端模型目录（客户端「CloudXxx」），从不写入本地
 * storage/server.json。直播音色的合成请求在主进程直接调用模型，
 * 因此需要像渲染层 serverCloudStore 一样，在本地找不到时回落到云端目录。
 *
 * 该模块不依赖 Electron，便于用假目录做单元测试。
 */

export type CloudModelRecord = {
    name: string;
    version: string;
    [key: string]: any;
};

export type CloudVoiceResolverOption = {
    /** 拉取云端模型目录（失败时抛错） */
    fetchCatalog: () => Promise<CloudModelRecord[]>;
    /** 目录缓存时长，默认 5 分钟 */
    ttl?: number;
    /** 当前时间，默认 Date.now（测试可注入） */
    now?: () => number;
    logInfo?: (message: string, data?: any) => void;
    logError?: (message: string, data?: any) => void;
};

export type CloudVoiceResolver = {
    /** 按 name + version 查找云模型；版本不符但同名唯一时回落 */
    find(name: string, version: string): Promise<CloudModelRecord | null>;
    /** 清空目录缓存 */
    clear(): void;
};

const DEFAULT_TTL = 5 * 60 * 1000;
/** 目录拉取失败后的退避时间：避免直播每句台词都卡在目录请求上 */
const FETCH_FAIL_BACKOFF = 30 * 1000;

export const createCloudVoiceResolver = (
    option: CloudVoiceResolverOption,
): CloudVoiceResolver => {
    const ttl = option.ttl ?? DEFAULT_TTL;
    const now = option.now ?? Date.now;
    const logInfo = option.logInfo ?? (() => {});
    const logError = option.logError ?? (() => {});
    let cache: { records: CloudModelRecord[]; expireAt: number } | null = null;
    let lastFetchErrorAt: number | null = null;

    const fetchCatalog = async (force: boolean) => {
        const time = now();
        if (!force && cache && cache.expireAt > time) {
            return cache.records;
        }
        if (
            lastFetchErrorAt !== null &&
            time - lastFetchErrorAt < FETCH_FAIL_BACKOFF
        ) {
            // 退避期内不再请求（离线/未登录时避免每句台词都等待超时）
            return cache ? cache.records : [];
        }
        try {
            const records = await option.fetchCatalog();
            // 空目录也缓存：确实没有云模型时不必每句都重新请求
            cache = {
                records,
                expireAt: time + ttl,
            };
            lastFetchErrorAt = null;
            return records;
        } catch (e) {
            lastFetchErrorAt = time;
            logError("httpserver.liveTts.cloudCatalogError", {
                msg: String(e),
            });
        }
        return cache ? cache.records : [];
    };

    return {
        async find(name, version) {
            let records = await fetchCatalog(false);
            let matched = records.find(
                (r) => r.name === name && r.version === version,
            );
            if (!matched && records.length > 0) {
                // 缓存可能已过期（云端目录升级了版本），强制刷新一次
                records = await fetchCatalog(true);
                matched = records.find(
                    (r) => r.name === name && r.version === version,
                );
            }
            if (matched) {
                return matched;
            }
            const sameName = records.filter((r) => r.name === name);
            if (sameName.length === 1) {
                logInfo("httpserver.liveTts.cloudVersionFallback", {
                    name,
                    want: version,
                    use: sameName[0].version,
                });
                return sameName[0];
            }
            return null;
        },
        clear() {
            cache = null;
            lastFetchErrorAt = 0;
        },
    };
};
