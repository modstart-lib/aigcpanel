import axios from "axios";
import crypto from "node:crypto";
import { Files } from "../../mapi/file/main";
import { Log } from "../../mapi/log/main";
import { VoiceApiConfig, VoiceApiParam } from "./types";

/**
 * 云厂商语音接口的公共工具：日志、脱敏、音频下载、参数构建。
 *
 * 说明：云端语音接口的失败大多发生在「添加模型时的试听校验」阶段，
 * 此时还没有 server 记录，调用链路也拿不到本地模型日志，所以这里必须
 * 主动写主进程日志，否则用户上报问题收集日志时看不到任何厂商请求信息。
 */

export const randomId = () => crypto.randomUUID();

export const saveAudio = async (
    buffer: Buffer,
    ext: string,
): Promise<string> => {
    const file = await Files.temp(ext);
    await Files.writeBuffer(file, buffer, { isDataPath: false });
    return file;
};

// ── 第三方接口排查日志 ────────────────────────────────────────────────────
export const logInfo = (label: string, data?: any) => {
    try {
        Log.info(`voiceApi.${label}`, data);
    } catch {
        /* logging must never break the call */
    }
};

export const logError = (label: string, data?: any) => {
    try {
        Log.error(`voiceApi.${label}`, data);
    } catch {
        /* logging must never break the call */
    }
};

/** 日志中不落完整密钥，只保留头尾用于区分 */
export const maskKey = (key?: string) => {
    const s = String(key || "");
    if (!s) {
        return "";
    }
    if (s.length <= 8) {
        return `${s.slice(0, 1)}***`;
    }
    return `${s.slice(0, 4)}***${s.slice(-4)}`;
};

/** 可安全写入日志的配置（去掉 apiKey 等敏感字段） */
export const maskVoiceApiConfig = (config: VoiceApiConfig | any) => {
    if (!config || typeof config !== "object") {
        return config;
    }
    const result: any = {};
    for (const key in config) {
        if (/key|token|secret|password/i.test(key)) {
            result[key] = maskKey(config[key]);
        } else {
            result[key] = config[key];
        }
    }
    return result;
};

export const truncate = (value: any, limit: number = 800) => {
    const s = typeof value === "string" ? value : JSON.stringify(value ?? null);
    if (!s) {
        return "";
    }
    return s.length > limit ? `${s.slice(0, limit)}...(len=${s.length})` : s;
};

const dataToText = (data: any): string => {
    if (data === null || data === undefined) {
        return "";
    }
    if (typeof data === "string") {
        return data;
    }
    if (Buffer.isBuffer(data)) {
        return data.toString("utf8");
    }
    if (data instanceof ArrayBuffer) {
        return Buffer.from(data).toString("utf8");
    }
    try {
        return JSON.stringify(data);
    } catch {
        return String(data);
    }
};

export const errorText = (e: any) => {
    if (!e) {
        return "";
    }
    if (e.response) {
        return `HTTP ${e.response.status} ${truncate(
            dataToText(e.response.data),
        )}`;
    }
    return e.message || String(e);
};

export const urlHost = (url: string) => {
    try {
        return new URL(url).host;
    } catch {
        return "";
    }
};

export const audioExtFromUrl = (url: string, fallback: string) => {
    const m = /\.(wav|mp3|ogg|opus|m4a|aac|flac|pcm)(?:[?#]|$)/i.exec(
        url || "",
    );
    return m ? m[1].toLowerCase() : fallback;
};

/**
 * 下载厂商返回的音频链接。
 *
 * 注意：DashScope 返回的是 OSS 预签名链接（URL 里带 Signature），
 * 这类链接只允许 query 中的签名鉴权；如果额外再带 Authorization 头，
 * OSS 会直接拒绝（InvalidArgument：URL 与 Header 同时带签名信息），
 * 表现为「链接有问题」。因此这里绝对不能携带 API Key。
 */
export const downloadAudioUrl = async (
    url: string,
    provider: string,
): Promise<Buffer> => {
    const label = `${provider}.download`;
    logInfo(`${label}.start`, { host: urlHost(url) });
    let res;
    try {
        res = await axios.get(url, {
            responseType: "arraybuffer",
            timeout: 120 * 1000,
            maxRedirects: 5,
            validateStatus: () => true,
        });
    } catch (e: any) {
        logError(`${label}.exception`, {
            host: urlHost(url),
            error: errorText(e),
        });
        throw new Error(`音频下载失败：${errorText(e)}`);
    }
    const buffer = Buffer.from(res.data || []);
    if (res.status >= 400 || buffer.length === 0) {
        const body = buffer.toString("utf8").slice(0, 500);
        logError(`${label}.error`, {
            status: res.status,
            host: urlHost(url),
            body,
        });
        throw new Error(
            `音频下载失败（HTTP ${res.status}）：${body || "响应为空"}`,
        );
    }
    logInfo(`${label}.done`, {
        status: res.status,
        bytes: buffer.length,
        contentType: res.headers?.["content-type"] || "",
    });
    return buffer;
};

/** 构建统一的 TTS 参数（音色 + 语速） */
export const buildTtsParam = (
    voices: { value: string; label: string }[],
    config: VoiceApiConfig,
): VoiceApiParam[] => {
    const options = [...voices];
    const defaultVoice = config.defaultVoice;
    if (defaultVoice && !options.some((o) => o.value === defaultVoice)) {
        options.unshift({ value: defaultVoice, label: defaultVoice });
    }
    return [
        {
            name: "speaker",
            type: "select",
            title: "音色",
            defaultValue: defaultVoice || options[0]?.value || "",
            options,
        },
        {
            name: "speed",
            type: "inputNumber",
            title: "语速",
            defaultValue: 1.0,
            min: 0.2,
            max: 3.0,
            step: 0.1,
        },
    ];
};
