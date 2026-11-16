import { ALIYUN_TTS_URL, AliyunProvider } from "./VoideDriver/aliyun";
import { VOLC_TTS_URL, VolcengineProvider } from "./VoideDriver/volcengine";
import {
    errorText,
    logError,
    logInfo,
    maskVoiceApiConfig,
    truncate,
} from "./VoideDriver/util";
import type { VoiceApiConfig, VoiceApiProvider } from "./VoideDriver/types";

/**
 * 云厂商 API 语音模型入口（当前仅支持语音合成 soundTts）
 *
 * 结构：
 * - VoiceApi.ts            注册表与对外 API（查找 provider、试听校验）
 * - VoideDriver/*.ts       各厂商驱动，把厂商 HTTP 接口适配为统一的 soundTts
 *
 * 约定：soundTts 返回音频文件的本地绝对路径（供上层 hubSave）。
 * 新增厂商只需在 VoideDriver 下实现一个 VoiceApiProvider 并注册到下方映射。
 */

export const VoiceApiProviders: Record<string, VoiceApiProvider> = {
    volcengine: VolcengineProvider,
    aliyun: AliyunProvider,
};

export const getVoiceApiProvider = (
    provider: string,
): VoiceApiProvider | undefined => {
    return VoiceApiProviders[provider];
};

/** 各厂商默认接口地址，供界面展示与用户覆盖参考 */
export const VoiceApiDefaultUrls: Record<string, string> = {
    volcengine: VOLC_TTS_URL,
    aliyun: ALIYUN_TTS_URL,
};

/** 试听/校验：用一段短文本合成，返回音频文件绝对路径 */
export const voiceApiTest = async (
    config: VoiceApiConfig,
    text: string,
): Promise<string> => {
    const provider = getVoiceApiProvider(config.provider);
    if (!provider) {
        throw new Error(`不支持的语音厂商：${config.provider}`);
    }
    const startTime = Date.now();
    logInfo("test.start", {
        config: maskVoiceApiConfig(config),
        text: truncate(text, 200),
    });
    try {
        const url = await provider.soundTts(config, { text, param: {} });
        logInfo("test.done", { duration: Date.now() - startTime, url });
        return url;
    } catch (e: any) {
        logError("test.failed", {
            duration: Date.now() - startTime,
            config: maskVoiceApiConfig(config),
            error: errorText(e),
        });
        throw e;
    }
};

export * from "./VoideDriver/types";
export { maskVoiceApiConfig } from "./VoideDriver/util";
