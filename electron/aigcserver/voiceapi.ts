import axios from "axios";
import crypto from "node:crypto";
import { Files } from "../mapi/file/main";

/**
 * 云厂商 API 语音模型 provider 注册表（当前仅支持语音合成 soundTts）
 *
 * 每个 provider 把厂商的 HTTP 接口适配为 AIGCPanel 统一的 soundTts 调用，
 * 供主进程 ApiServer（type=api 模型）使用。新增厂商只需实现一个 provider 并注册。
 * 约定：soundTts 返回音频文件的本地绝对路径（供上层 hubSave）。
 */

export type VoiceApiConfig = {
    provider: string;
    [key: string]: any;
};

export type VoiceApiParam = {
    name: string;
    type: string;
    title: string;
    defaultValue?: any;
    placeholder?: string;
    options?: { value: string; label: string }[];
    [key: string]: any;
};

export type VoiceApiFunctionDef = {
    content?: string;
    param?: VoiceApiParam[];
};

export type VoiceApiProvider = {
    id: string;
    title: string;
    /** 该 provider 支持的 function 定义（用于 config()） */
    functions(config: VoiceApiConfig): { [func: string]: VoiceApiFunctionDef };
    /** 语音合成，返回音频文件绝对路径 */
    soundTts(config: VoiceApiConfig, data: any): Promise<string>;
};

const randomId = () => crypto.randomUUID();

const saveAudio = async (buffer: Buffer, ext: string): Promise<string> => {
    const file = await Files.temp(ext);
    await Files.writeBuffer(file, buffer, { isDataPath: false });
    return file;
};

const buildTtsParam = (
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

// ── 火山引擎（豆包语音）────────────────────────────────────────────────────
// 新版控制台使用单个 API Key（X-Api-Key）鉴权。
// 参考：https://www.volcengine.com/docs/6561/1598757
// 注意：豆包语音的 API Key 与「火山方舟(Ark)」的 API Key 不互通，需在豆包语音控制台获取。
const VOLC_TTS_URL =
    "https://openspeech.bytedance.com/api/v3/tts/unidirectional";
const VOLC_TTS_RESOURCE = "seed-tts-2.0";

// 豆包语音合成大模型 2.0 音色（已验证可用）
const VOLC_VOICES = [
    { value: "zh_female_vv_uranus_bigtts", label: "VV（女声）" },
    { value: "zh_female_cancan_uranus_bigtts", label: "灿灿（女声）" },
    {
        value: "zh_female_shuangkuaisisi_uranus_bigtts",
        label: "爽快思思（女声）",
    },
    {
        value: "zh_female_tianmeixiaoyuan_uranus_bigtts",
        label: "甜美小源（女声）",
    },
    {
        value: "zh_female_meilinvyou_uranus_bigtts",
        label: "魅力女友（女声）",
    },
    { value: "zh_male_wennuanahu_uranus_bigtts", label: "温暖阿虎（男声）" },
    {
        value: "zh_male_yangguangqingnian_uranus_bigtts",
        label: "阳光青年（男声）",
    },
];

/**
 * 解析火山 V3 单向流式响应（多个 JSON 对象拼接，非标准 SSE）：
 * - code=0 + data(base64)：音频分片
 * - code=20000000：合成完成
 * - 其它 code：错误
 */
const parseVolcStream = (raw: string): Buffer => {
    const parts: string[] = [];
    let errMsg = "";
    const handle = (obj: any) => {
        if (!obj || typeof obj !== "object") {
            return;
        }
        const header = obj.header;
        if (header && header.code && header.code !== 0) {
            errMsg = `${header.code}: ${header.message || ""}`;
            return;
        }
        if (obj.code === 0 && obj.data) {
            parts.push(obj.data);
        } else if (obj.code && obj.code !== 0 && obj.code !== 20000000) {
            errMsg = `${obj.code}: ${obj.message || obj.msg || ""}`;
        }
    };
    try {
        handle(JSON.parse(raw));
    } catch {
        /* ignore */
    }
    for (const line of raw.split("\n")) {
        const s = line.replace(/^data:\s*/, "").trim();
        if (!s) {
            continue;
        }
        try {
            handle(JSON.parse(s));
        } catch {
            /* ignore */
        }
    }
    if (parts.length === 0) {
        const matches = raw.match(/\{"code"\s*:\s*\d+[^{}]*\}/g) || [];
        for (const m of matches) {
            try {
                handle(JSON.parse(m));
            } catch {
                /* ignore */
            }
        }
    }
    if (parts.length === 0) {
        throw new Error(`火山引擎语音合成失败：${errMsg || raw.slice(0, 300)}`);
    }
    return Buffer.concat(parts.map((p) => Buffer.from(p, "base64")));
};

const VolcengineProvider: VoiceApiProvider = {
    id: "volcengine",
    title: "火山引擎（豆包语音）",
    functions(config) {
        return {
            soundTts: { param: buildTtsParam(VOLC_VOICES, config) },
        };
    },
    async soundTts(config, data) {
        const apiKey = config.apiKey;
        if (!apiKey) {
            throw new Error("火山引擎需要填写 API Key");
        }
        const text = data.text;
        if (!text) {
            throw new Error("合成文本为空");
        }
        const voice =
            data.param?.speaker || config.defaultVoice || VOLC_VOICES[0].value;
        const speed = Number(data.param?.speed) || 1.0;
        const res = await axios.post(
            VOLC_TTS_URL,
            {
                user: { uid: "aigcpanel" },
                req_params: {
                    text,
                    speaker: voice,
                    audio_params: { format: "mp3", sample_rate: 24000 },
                    speed_ratio: speed,
                },
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "X-Api-Key": apiKey,
                    "X-Api-Resource-Id": config.resourceId || VOLC_TTS_RESOURCE,
                    "X-Api-Request-Id": randomId(),
                },
                timeout: 120 * 1000,
                responseType: "text",
                transformResponse: [(d) => d],
                validateStatus: () => true,
            },
        );
        const raw =
            typeof res.data === "string" ? res.data : JSON.stringify(res.data);
        if (res.status >= 400 && !raw) {
            throw new Error(`火山引擎语音合成失败（HTTP ${res.status}）`);
        }
        const buffer = parseVolcStream(raw);
        return await saveAudio(buffer, "mp3");
    },
};

// ── 阿里云百炼（DashScope）─────────────────────────────────────────────────
// 参考：https://help.aliyun.com/zh/model-studio/qwen-tts-api
const ALIYUN_TTS_URL =
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";
const ALIYUN_VOICES = [
    { value: "Cherry", label: "Cherry（女声）" },
    { value: "Serena", label: "Serena（女声）" },
    { value: "Ethan", label: "Ethan（男声）" },
    { value: "Chelsie", label: "Chelsie（女声）" },
];

const downloadAudio = async (audio: any, apiKey: string): Promise<Buffer> => {
    if (audio.url) {
        const res = await axios.get(audio.url, {
            responseType: "arraybuffer",
            timeout: 120 * 1000,
            headers: { Authorization: `Bearer ${apiKey}` },
        });
        return Buffer.from(res.data);
    }
    if (audio.data) {
        return Buffer.from(audio.data, "base64");
    }
    throw new Error("阿里云未返回音频数据");
};

const AliyunProvider: VoiceApiProvider = {
    id: "aliyun",
    title: "阿里云百炼（DashScope）",
    functions(config) {
        return {
            soundTts: { param: buildTtsParam(ALIYUN_VOICES, config) },
        };
    },
    async soundTts(config, data) {
        const apiKey = config.apiKey;
        if (!apiKey) {
            throw new Error("阿里云百炼需要填写 API Key");
        }
        const text = data.text;
        if (!text) {
            throw new Error("合成文本为空");
        }
        const model = config.model || "qwen-tts";
        const voice = data.param?.speaker || config.defaultVoice || "Cherry";
        const res = await axios.post(
            ALIYUN_TTS_URL,
            { model, input: { text, voice } },
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                timeout: 120 * 1000,
                validateStatus: () => true,
            },
        );
        const d = res.data;
        const audio = d?.output?.audio;
        if (res.status >= 400 || !audio) {
            throw new Error(
                `阿里云语音合成失败：${
                    d?.message || d?.code || JSON.stringify(d).slice(0, 300)
                }`,
            );
        }
        const buffer = await downloadAudio(audio, apiKey);
        return await saveAudio(buffer, "wav");
    },
};

export const VoiceApiProviders: Record<string, VoiceApiProvider> = {
    volcengine: VolcengineProvider,
    aliyun: AliyunProvider,
};

export const getVoiceApiProvider = (
    provider: string,
): VoiceApiProvider | undefined => {
    return VoiceApiProviders[provider];
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
    return await provider.soundTts(config, { text, param: {} });
};
