import { Router } from "express";
import type { Request, Response } from "express";
import { DBMain } from "../../db/main";
import { Files } from "../../file/main";
import { Log } from "../../log/main";
import { ServerMain } from "../../server/main";
import type { ServerInfo } from "../../server/type";
import { StorageMain } from "../../storage/main";
import { sendJson, asyncHandler } from "../utils";

const router = Router();

// data_storage 中直播音色的 biz 标识（与 src/service/StorageService.ts 保持一致）
const LIVE_VOICE_BIZ = "LiveVoice";

/**
 * 构建模型调用所需的 ServerInfo。
 * 与渲染层 serverStore.serverInfo 保持一致：LOCAL/REMOTE 使用数据目录的绝对路径。
 */
const buildServerInfo = async (server: any): Promise<ServerInfo> => {
    const type = server.type || "localDir";
    let localPath = server.localPath || "";
    if (type === "local" || type === "remote") {
        localPath = await Files.fullPath(localPath);
    }
    return {
        localPath,
        name: server.name,
        version: server.version,
        type,
        setting: server.setting || {},
        logFile: `logs/live_voice_${server.name}_${Date.now()}.log`,
        eventChannelName: "",
        config: server,
    } as ServerInfo;
};

/**
 * 使用指定音色合成文本，返回音频的本地绝对路径。
 * 直接在主进程调用模型（与 IPC server:callFunction 复用同一套模块缓存），
 * 无需经过渲染进程，直播服务离线也能合成。
 */
const synthesize = async (voice: any, text: string): Promise<string> => {
    const content = voice.content || {};
    if (!content.serverName || !content.serverVersion) {
        throw new Error("VoiceModelMissing");
    }
    const storageData = (await StorageMain.read("server", null)) || {};
    const records: any[] = Array.isArray(storageData.records)
        ? storageData.records
        : [];
    const server = records.find(
        (r: any) =>
            r.name === content.serverName &&
            r.version === content.serverVersion,
    );
    if (!server) {
        throw new Error("VoiceServerNotFound");
    }
    const serverInfo = await buildServerInfo(server);
    const method = content.type === "clone" ? "soundClone" : "soundTts";
    const id = `live_voice_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const data: any =
        content.type === "clone"
            ? {
                  id,
                  result: {},
                  param: content.param || {},
                  text,
                  promptAudio: content.promptUrl || "",
                  promptText: content.promptText || "",
              }
            : {
                  id,
                  result: {},
                  param: content.param || {},
                  text,
              };
    let res: any = null;
    for (let i = 0; i < 60; i++) {
        res = await ServerMain.callFunction(serverInfo, method, data);
        if (res && res.code === 0 && res.data && res.data.type === "retry") {
            // 模型正忙，稍后重试
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
    // 结果复制到 hub，返回稳定可读的本地绝对路径
    return await Files.hubSave(rawUrl);
};

// ── POST /api/live/tts ─────────────────────────────────────────────────────
// 直播音色统一合成接口：直播服务只传音色 id 与文本，客户端负责解析音色
// （合成模型/参数或复刻参考音频）并完成合成，返回音频的本地绝对路径。
// 新增音色只需在客户端「音色管理」中添加，直播端无需任何改动。
//
// 请求：{ voiceId: number, text: string }
// 响应：{ code: 0, data: { url: string } }
router.post(
    "/tts",
    asyncHandler(async (req: Request, res: Response) => {
        const { voiceId, text } = req.body || {};
        if (!voiceId) {
            sendJson(res, 400, { code: -1, msg: "Missing voiceId" });
            return;
        }
        if (!text) {
            sendJson(res, 400, { code: -1, msg: "Missing text" });
            return;
        }
        const record = await DBMain.first(
            `SELECT * FROM data_storage WHERE biz = ? AND id = ?`,
            [LIVE_VOICE_BIZ, Number(voiceId)],
        );
        if (!record) {
            sendJson(res, 404, { code: -1, msg: "VoiceNotFound" });
            return;
        }
        let voice: any = record;
        try {
            voice.content = record.content ? JSON.parse(record.content) : {};
        } catch (e) {
            voice.content = {};
        }
        try {
            const url = await synthesize(voice, String(text));
            sendJson(res, 200, { code: 0, data: { url } });
        } catch (e: any) {
            Log.error("httpserver.liveTts.error", String(e));
            sendJson(res, 500, {
                code: -1,
                msg: String((e && e.message) || e),
            });
        }
    }),
);

export default router;
