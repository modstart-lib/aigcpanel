import axios from "axios";
import { VoiceApiConfig, VoiceApiProvider } from "./types";
import {
    audioExtFromUrl,
    buildTtsParam,
    downloadAudioUrl,
    errorText,
    logError,
    logInfo,
    maskKey,
    saveAudio,
    truncate,
    urlHost,
} from "./util";

/**
 * 阿里云百炼（DashScope）
 *
 * 参考：https://help.aliyun.com/zh/model-studio/qwen-tts-non-realtime-api
 * 关键点：
 * 1. 接口地址为 .../api/v1/services/aigc/multimodal-generation/generation，
 *    北京地域与新加坡地域不同（dashscope-intl.aliyuncs.com），允许用户覆盖；
 * 2. 当前模型为 qwen3-tts-flash（旧的 qwen-tts 已逐步下线），因此默认用它；
 * 3. 返回的 audio.url 是 OSS 预签名链接，下载时不能携带 Authorization，
 *    否则 OSS 会以「URL 与 Header 同时带签名信息」拒绝，看起来就像链接失效。
 */

const ALIYUN_TTS_HOST = "https://dashscope.aliyuncs.com";
const ALIYUN_TTS_PATH = "/services/aigc/multimodal-generation/generation";
export const ALIYUN_TTS_URL = `${ALIYUN_TTS_HOST}/api/v1${ALIYUN_TTS_PATH}`;
const ALIYUN_DEFAULT_MODEL = "qwen3-tts-flash";

// qwen-tts 已不在官方支持列表，旧配置自动迁移到当前模型，避免老用户继续失败
const ALIYUN_MODEL_ALIASES: Record<string, string> = {
    "qwen-tts": ALIYUN_DEFAULT_MODEL,
    "qwen-tts-latest": ALIYUN_DEFAULT_MODEL,
};

const ALIYUN_VOICES = [
    { value: "Cherry", label: "Cherry（女声）" },
    { value: "Serena", label: "Serena（女声）" },
    { value: "Ethan", label: "Ethan（男声）" },
    { value: "Chelsie", label: "Chelsie（女声）" },
];

/**
 * 生成阿里云合成接口地址。
 *
 * 支持用户填写：
 * - 完整接口地址（按原样使用）
 * - 地域/代理根地址，如 https://dashscope-intl.aliyuncs.com
 * - 带 api/v1 的地址，如 https://proxy.example.com/api/v1
 */
const aliyunApiUrl = (config: VoiceApiConfig) => {
    let url = (config.apiUrl || "").trim();
    if (!url) {
        return ALIYUN_TTS_URL;
    }
    // 用户直接粘贴完整接口地址（如 qwen3-tts 的 multimodal-generation，
    // 或 qwen-audio-tts / cosyvoice 的 /services/audio/tts/... ）时按原样使用
    if (/\/services\//i.test(url)) {
        return url;
    }
    url = url.replace(/\/+$/, "");
    if (!/\/api\/v\d+[a-z0-9]*$/i.test(url)) {
        url += "/api/v1";
    }
    return `${url}${ALIYUN_TTS_PATH}`;
};

export const AliyunProvider: VoiceApiProvider = {
    id: "aliyun",
    title: "阿里云百炼（DashScope）",
    defaultApiUrl: ALIYUN_TTS_URL,
    functions(config) {
        return {
            soundTts: { param: buildTtsParam(ALIYUN_VOICES, config) },
        };
    },
    async soundTts(config, data) {
        const apiKey = (config.apiKey || "").trim();
        if (!apiKey) {
            throw new Error("阿里云百炼需要填写 API Key");
        }
        const text = data.text;
        if (!text) {
            throw new Error("合成文本为空");
        }
        const requestedModel = (config.model || "").trim();
        const model =
            ALIYUN_MODEL_ALIASES[requestedModel] ||
            requestedModel ||
            ALIYUN_DEFAULT_MODEL;
        if (requestedModel && model !== requestedModel) {
            logInfo("aliyun.soundTts.modelAlias", {
                from: requestedModel,
                to: model,
            });
        }
        const voice = data.param?.speaker || config.defaultVoice || "Cherry";
        const url = aliyunApiUrl(config);
        const input: any = { text, voice };
        if (config.languageType) {
            input.language_type = config.languageType;
        }
        const startTime = Date.now();
        logInfo("aliyun.soundTts.start", {
            host: urlHost(url),
            url,
            model,
            voice,
            textLength: text.length,
            text: truncate(text, 200),
            apiKey: maskKey(apiKey),
        });
        let res;
        try {
            res = await axios.post(
                url,
                { model, input },
                {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                    },
                    timeout: 120 * 1000,
                    validateStatus: () => true,
                },
            );
        } catch (e: any) {
            logError("aliyun.soundTts.exception", {
                host: urlHost(url),
                model,
                duration: Date.now() - startTime,
                error: errorText(e),
            });
            throw new Error(`阿里云语音合成请求失败：${errorText(e)}`);
        }
        const d: any = res.data;
        const audio = d?.output?.audio;
        const hasAudio = !!(audio && (audio.url || audio.data));
        if (res.status >= 400 || !hasAudio) {
            const detail =
                d?.message ||
                d?.code ||
                truncate(
                    typeof d === "string" ? d : JSON.stringify(d || {}),
                    500,
                ) ||
                "响应中没有音频数据";
            logError("aliyun.soundTts.failed", {
                status: res.status,
                host: urlHost(url),
                model,
                code: d?.code || "",
                message: d?.message || "",
                requestId: d?.request_id || "",
                duration: Date.now() - startTime,
                response: truncate(
                    typeof d === "string" ? d : JSON.stringify(d || {}),
                    1500,
                ),
            });
            throw new Error(
                `阿里云语音合成失败（HTTP ${res.status}，模型 ${model}）：${detail}`,
            );
        }
        // 预签名 OSS 链接优先，失败时再回退到 base64 数据
        let buffer: Buffer;
        let ext = "wav";
        if (audio.url) {
            ext = audioExtFromUrl(audio.url, "wav");
            try {
                buffer = await downloadAudioUrl(audio.url, "aliyun");
            } catch (e: any) {
                if (audio.data) {
                    logInfo("aliyun.download.fallbackBase64", {
                        error: errorText(e),
                    });
                    buffer = Buffer.from(audio.data, "base64");
                } else {
                    throw e;
                }
            }
        } else {
            buffer = Buffer.from(audio.data, "base64");
        }
        logInfo("aliyun.soundTts.done", {
            status: res.status,
            model,
            duration: Date.now() - startTime,
            bytes: buffer.length,
            ext,
            fromUrl: !!audio.url,
        });
        return await saveAudio(buffer, ext);
    },
};
