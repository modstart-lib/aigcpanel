import { reactive } from "vue";
import { StorageRecord, StorageService } from "./StorageService";
import { DataService } from "./DataService";
import { useServerStore } from "../store/modules/server";

/**
 * 音色（Voice）
 *
 * 一个音色 = 一次可复用的「语音能力」绑定：
 * - type=tts：声音合成模型 + 参数（如 speaker 音色）
 * - type=clone：声音复刻模型 + 参考音频/文本（参考音频为全新录音/上传，不复用其它库）
 *
 * 共两套独立存储（数据表 biz）：
 * - LiveVoice 直播音色（智能直播使用）
 * - SoundVoice 语音音色（数字人/语音合成使用）
 *
 * 所有声音调用统一走该服务，直播端等外部只选择音色即可。
 */
export type VoiceType = "tts" | "clone";

export type VoiceContent = {
    type: VoiceType;
    /** 模型标识 "name|version" */
    serverKey: string;
    serverName: string;
    serverTitle: string;
    serverVersion: string;
    /** 声音合成/复刻参数，如 { speaker: "中文女" } */
    param?: Record<string, any>;
    /** 声音复刻：参考音频（本地路径，全新录音/上传） */
    promptUrl?: string;
    /** 声音复刻：参考文本 */
    promptText?: string;
    /** 试听音频（本地路径） */
    previewUrl?: string;
    /** 试听文本（保存后用于补齐试听音频） */
    previewText?: string;
};

export type VoiceRecord = StorageRecord & {
    content: VoiceContent;
};

/** 直播音色存储标识 */
export const VOICE_BIZ_LIVE = "LiveVoice";
/** 语音音色存储标识 */
export const VOICE_BIZ_SOUND = "SoundVoice";

/** 试听音频生成状态：generating 生成中，failed 生成失败（可重试） */
export type VoicePreviewStatus = "generating" | "failed";

/** 试听音频生成状态记录 */
type VoicePreviewState = {
    status: VoicePreviewStatus;
    /** 失败原因（用于展示，便于排查） */
    message?: string;
};

/**
 * 试听音频生成状态（内存态，按「音色」维度追踪）。
 * 保存音色时若未试听，列表卡片据此展示「试听语音生成中」。
 */
const voicePreviewStatusMap = reactive<Record<string, VoicePreviewState>>({});

const voicePreviewStatusKey = (biz: string, id: number) => `${biz}:${id}`;

/** 直播音色 provider 名称前缀（面板下发给直播服务，直播据此路由到客户端接口） */
export const LIVE_VOICE_PROVIDER_PREFIX = "Voice:";

export const liveVoiceProviderName = (voiceId: number) => {
    return `${LIVE_VOICE_PROVIDER_PREFIX}${voiceId}`;
};

export const parseLiveVoiceProviderName = (name: string): number | null => {
    if (!name || !name.startsWith(LIVE_VOICE_PROVIDER_PREFIX)) {
        return null;
    }
    const id = parseInt(name.slice(LIVE_VOICE_PROVIDER_PREFIX.length), 10);
    return isNaN(id) ? null : id;
};

const serverStore = useServerStore();

const createVoiceService = (
    biz: typeof VOICE_BIZ_LIVE | typeof VOICE_BIZ_SOUND,
) => {
    return {
        biz,
        async list(): Promise<VoiceRecord[]> {
            return (await StorageService.list(biz)) as VoiceRecord[];
        },
        async get(id: number): Promise<VoiceRecord | null> {
            return (await StorageService.get(id)) as VoiceRecord | null;
        },
        async add(record: {
            title: string;
            content: VoiceContent;
        }): Promise<number | void> {
            return await StorageService.add(biz, record);
        },
        async update(id: number, record: Partial<StorageRecord>) {
            return await StorageService.update(id, record);
        },
        async delete(record: StorageRecord) {
            // 清理音色关联的本地音频文件（参考音频、试听音频）
            const content: any = record.content || {};
            for (const key of ["promptUrl", "previewUrl"]) {
                const url = content[key];
                if (
                    url &&
                    typeof url === "string" &&
                    !/^https?:\/\//i.test(url) &&
                    !url.startsWith("file://")
                ) {
                    try {
                        await window.$mapi.file.deletes(url);
                    } catch (e) {
                        // ignore cleanup error
                    }
                }
            }
            return await StorageService.delete(record);
        },
        /**
         * 由音色构建声音合成任务的 modelConfig（结构与 SoundGenerate 任务一致）
         */
        buildModelConfig(voice: VoiceRecord, text: string): any {
            const c = voice.content;
            if (c.type === "clone") {
                return {
                    type: "SoundClone",
                    cloneServerKey: c.serverKey,
                    cloneParam: c.param || {},
                    promptUrl: c.promptUrl || "",
                    promptText: c.promptText || "",
                    text,
                };
            }
            return {
                type: "SoundTts",
                ttsServerKey: c.serverKey,
                ttsParam: c.param || {},
                text,
            };
        },
        /**
         * 使用指定音色合成一段文本，返回音频的本地绝对路径。
         * 合成统一走 serverStore.call（复用声音合成的成熟调用链），
         * 供「试听」与「直播实时合成」共用。
         */
        async synthesize(voice: VoiceRecord, text: string): Promise<string> {
            if (!voice.content) {
                throw new Error("VoiceContentMissing");
            }
            // 传入的 record 可能来自 Vue 响应式列表，content/param 是 reactive 代理，
            // 直接经 Electron IPC 传输会报「An object could not be cloned」，
            // 因此先克隆为纯对象再使用。
            const content: VoiceContent = JSON.parse(
                JSON.stringify(voice.content),
            );
            const server = await serverStore.getByNameVersion(
                content.serverName,
                content.serverVersion,
            );
            if (!server) {
                throw new Error("VoiceServerNotFound");
            }
            const serverInfo = await serverStore.serverInfo(server);
            const bizId = `voice_${Date.now()}_${Math.floor(
                Math.random() * 10000,
            )}`;
            const call = async () => {
                if (content.type === "clone") {
                    return await serverStore.call(serverInfo, "soundClone", {
                        id: `SoundClone_${bizId}`,
                        result: {},
                        param: content.param || {},
                        text,
                        promptAudio: content.promptUrl || "",
                        promptText: content.promptText || "",
                    });
                }
                return await serverStore.call(serverInfo, "soundTts", {
                    id: `SoundTts_${bizId}`,
                    result: {},
                    param: content.param || {},
                    text,
                });
            };
            let res: any = null;
            for (let i = 0; i < 60; i++) {
                res = await call();
                if (
                    res &&
                    res.code === 0 &&
                    res.data &&
                    res.data.type === "retry"
                ) {
                    await new Promise((r) => setTimeout(r, 1000));
                    continue;
                }
                break;
            }
            if (!res || res.code) {
                throw new Error((res && res.msg) || "SynthesizeFailed");
            }
            if (res.data && res.data.type === "retry") {
                throw new Error("SynthesizeBusy");
            }
            const rawUrl = res.data && res.data.data && res.data.data.url;
            if (!rawUrl) {
                throw new Error("SynthesizeEmptyResult");
            }
            return await DataService.saveFile(rawUrl);
        },
        /**
         * 查询指定音色的试听音频生成状态；空字符串表示当前无进行中的任务。
         * 返回值为响应式，列表卡片直接依赖它展示「生成中 / 失败」。
         */
        previewStatus(id?: number): VoicePreviewStatus | "" {
            if (!id) {
                return "";
            }
            return (
                voicePreviewStatusMap[voicePreviewStatusKey(biz, id)]?.status ||
                ""
            );
        },
        /** 查询指定音色试听音频的失败原因（无则为空字符串） */
        previewError(id?: number): string {
            if (!id) {
                return "";
            }
            return (
                voicePreviewStatusMap[voicePreviewStatusKey(biz, id)]
                    ?.message || ""
            );
        },
        /**
         * 后台生成试听音频并写回音色记录（保存时未试听的场景）。
         * - 生成前立即标记 generating，列表卡片据此展示「试听语音生成中」；
         * - 成功后写回 previewUrl 并回调 onUpdated 刷新列表，失败标记 failed 供重试。
         */
        async generatePreview(
            voice: VoiceRecord,
            text: string,
            onUpdated?: () => void,
        ): Promise<void> {
            const id = voice.id as number;
            if (!id) {
                return;
            }
            const key = voicePreviewStatusKey(biz, id);
            if (voicePreviewStatusMap[key]?.status === "generating") {
                return;
            }
            voicePreviewStatusMap[key] = { status: "generating" };
            try {
                const url = await this.synthesize(voice, text);
                const latest = await this.get(id);
                if (!latest) {
                    // 音色已被删除，放弃写回。
                    delete voicePreviewStatusMap[key];
                    return;
                }
                const oldUrl = latest.content?.previewUrl;
                await this.update(id, {
                    content: { ...(latest.content || {}), previewUrl: url },
                } as any);
                if (
                    oldUrl &&
                    oldUrl !== url &&
                    !/^https?:\/\//i.test(oldUrl) &&
                    !oldUrl.startsWith("file://")
                ) {
                    try {
                        await window.$mapi.file.deletes(oldUrl);
                    } catch {
                        // ignore cleanup error
                    }
                }
                delete voicePreviewStatusMap[key];
                onUpdated?.();
            } catch (e: any) {
                const message = (e && e.message) || String(e);
                voicePreviewStatusMap[key] = { status: "failed", message };
            }
        },
    };
};

/** 直播音色 */
export const LiveVoiceService = createVoiceService(VOICE_BIZ_LIVE);
/** 语音音色 */
export const SoundVoiceService = createVoiceService(VOICE_BIZ_SOUND);

export type VoiceServiceType = ReturnType<typeof createVoiceService>;
