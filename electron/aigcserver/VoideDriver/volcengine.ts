import axios from "axios";
import { VoiceApiProvider } from "./types";
import {
    buildTtsParam,
    errorText,
    logError,
    logInfo,
    maskKey,
    randomId,
    saveAudio,
    truncate,
    urlHost,
} from "./util";

/**
 * 火山引擎（豆包语音）
 *
 * 新版控制台使用单个 API Key（X-Api-Key）鉴权。
 * 参考：https://www.volcengine.com/docs/6561/1598757
 * 注意：豆包语音的 API Key 与「火山方舟(Ark)」的 API Key 不互通，
 * 需在豆包语音控制台获取。
 */

export const VOLC_TTS_URL =
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

export const VolcengineProvider: VoiceApiProvider = {
    id: "volcengine",
    title: "火山引擎（豆包语音）",
    defaultApiUrl: VOLC_TTS_URL,
    functions(config) {
        return {
            soundTts: { param: buildTtsParam(VOLC_VOICES, config) },
        };
    },
    async soundTts(config, data) {
        const apiKey = (config.apiKey || "").trim();
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
        const url = (config.apiUrl || "").trim() || VOLC_TTS_URL;
        const resourceId = config.resourceId || VOLC_TTS_RESOURCE;
        const startTime = Date.now();
        logInfo("volcengine.soundTts.start", {
            host: urlHost(url),
            url,
            resourceId,
            voice,
            speed,
            textLength: text.length,
            text: truncate(text, 200),
            apiKey: maskKey(apiKey),
        });
        let res;
        try {
            res = await axios.post(
                url,
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
                        "X-Api-Resource-Id": resourceId,
                        "X-Api-Request-Id": randomId(),
                    },
                    timeout: 120 * 1000,
                    responseType: "text",
                    transformResponse: [(d) => d],
                    validateStatus: () => true,
                },
            );
        } catch (e: any) {
            logError("volcengine.soundTts.exception", {
                host: urlHost(url),
                duration: Date.now() - startTime,
                error: errorText(e),
            });
            throw new Error(`火山引擎语音合成请求失败：${errorText(e)}`);
        }
        const raw =
            typeof res.data === "string" ? res.data : JSON.stringify(res.data);
        if (res.status >= 400 && !raw) {
            logError("volcengine.soundTts.httpError", {
                status: res.status,
                host: urlHost(url),
                duration: Date.now() - startTime,
            });
            throw new Error(`火山引擎语音合成失败（HTTP ${res.status}）`);
        }
        let buffer: Buffer;
        try {
            buffer = parseVolcStream(raw);
        } catch (e: any) {
            logError("volcengine.soundTts.parseError", {
                status: res.status,
                duration: Date.now() - startTime,
                response: truncate(raw, 1200),
            });
            throw e;
        }
        logInfo("volcengine.soundTts.done", {
            status: res.status,
            duration: Date.now() - startTime,
            bytes: buffer.length,
        });
        return await saveAudio(buffer, "mp3");
    },
};
