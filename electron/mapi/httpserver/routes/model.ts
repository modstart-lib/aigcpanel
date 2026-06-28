import { Router } from "express";
import type { Request, Response } from "express";
import { StorageMain } from "../../storage/main";
import { DBMain } from "../../db/main";
import { Events } from "../../event/main";
import { Log } from "../../log/main";
import {
    sendJson,
    asyncHandler,
    pollQuery,
    functionArgsMap,
    functionBizMap,
} from "../utils";

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────

const getInstalledServers = async () => {
    const storageData = await StorageMain.read("server", null);
    const records = storageData?.records || [];
    return records
        .filter((r: any) => r.name && r.version)
        .map((r: any) => ({
            id: `${r.name}|${r.version}`,
            name: r.name,
            version: r.version,
            title: r.title || r.name,
            functions: (r.functions || []).map((funcName: string) => ({
                name: funcName,
                args: functionArgsMap[funcName] || [],
                param: r.config?.functions?.[funcName]?.param || [],
            })),
        }));
};

const getServerRecord = async (serverName: string, serverVersion: string) => {
    const storageData = await StorageMain.read("server", null);
    const records = storageData?.records || [];
    return records.find(
        (r: any) => r.name === serverName && r.version === serverVersion,
    );
};

const buildModelConfig = (
    funcName: string,
    serverName: string,
    serverTitle: string,
    serverVersion: string,
    param: any,
) => {
    switch (funcName) {
        case "soundTts":
            return {
                type: "SoundTts",
                ttsServerKey: `${serverName}|${serverVersion}`,
                ttsParam: param?.param || {},
                text: param?.text || "",
            };
        case "soundClone":
            return {
                type: "SoundClone",
                cloneServerKey: `${serverName}|${serverVersion}`,
                cloneParam: param?.param || {},
                text: param?.text || "",
                promptUrl: param?.promptAudio || "",
                promptText: param?.promptText || "",
            };
        case "videoGen":
            return {
                soundType: "soundCustom",
                soundCustomFile: param?.audio || "",
                videoTemplateUrl: param?.video || "",
            };
        case "asr":
            return {
                audio: param?.audio || "",
            };
        case "textToImage":
            return {
                prompt: param?.prompt || "",
                textToImage: {
                    serverName,
                    serverTitle,
                    serverVersion,
                    type: "TextToImage",
                    serverKey: `${serverName}|${serverVersion}`,
                    param: param?.param || {},
                },
            };
        case "imageToImage":
            return {
                image: param?.image || "",
                prompt: param?.prompt || "",
                imageToImage: {
                    serverName,
                    serverTitle,
                    serverVersion,
                    type: "ImageToImage",
                    serverKey: `${serverName}|${serverVersion}`,
                    param: param?.param || {},
                },
            };
        default:
            return param || {};
    }
};

const buildTaskParam = (funcName: string, param: any) => {
    if (funcName === "videoGen" || funcName === "asr") {
        return param?.param || {};
    }
    return {};
};

const buildTaskTitle = (funcName: string, param: any): string => {
    switch (funcName) {
        case "soundTts":
            return param?.text ? String(param.text).slice(0, 20) : "TTS任务";
        case "soundClone":
            return param?.text
                ? String(param.text).slice(0, 20)
                : "音色克隆任务";
        case "videoGen":
            return "AI数字人视频";
        case "asr":
            return "ASR识别任务";
        case "textToImage":
            return param?.prompt
                ? String(param.prompt).slice(0, 20)
                : "文生图任务";
        case "imageToImage":
            return param?.prompt
                ? String(param.prompt).slice(0, 20)
                : "图生图任务";
        default:
            return "任务";
    }
};

// ── GET /api/model/list ──────────────────────────────────────────────────
router.get(
    "/list",
    asyncHandler(async (_req: Request, res: Response) => {
        const servers = await getInstalledServers();
        sendJson(res, 200, { code: 0, data: servers });
    }),
);

// ── POST /api/model/call ─────────────────────────────────────────────────
router.post(
    "/call",
    asyncHandler(async (req: Request, res: Response) => {
        const { model, version, function: funcName, param } = req.body || {};
        let serverName: string;
        let serverVersion: string;
        if (version !== undefined) {
            serverName = model || "";
            serverVersion = version || "";
        } else {
            const parts = (model || "").split("|");
            serverName = parts[0];
            serverVersion = parts.slice(1).join("|");
        }
        if (!serverName || !serverVersion) {
            sendJson(res, 400, {
                code: -1,
                msg: "Missing model or version",
            });
            return;
        }
        if (!funcName) {
            sendJson(res, 400, { code: -1, msg: "Missing function" });
            return;
        }
        const biz = functionBizMap[funcName];
        if (!biz) {
            sendJson(res, 400, {
                code: -1,
                msg: `Unknown function: ${funcName}`,
            });
            return;
        }
        const serverRecord = await getServerRecord(serverName, serverVersion);
        if (!serverRecord) {
            sendJson(res, 400, {
                code: -1,
                msg: `Server not found: ${serverName}|${serverVersion}`,
            });
            return;
        }
        const serverTitle = serverRecord.title || serverName;
        const modelConfig = buildModelConfig(
            funcName,
            serverName,
            serverTitle,
            serverVersion,
            param,
        );
        const taskParam = buildTaskParam(funcName, param);
        const title = buildTaskTitle(funcName, param);
        const taskDbId = await DBMain.insert(
            `INSERT INTO data_task (biz, title, status, startTime, serverName, serverTitle, serverVersion, param, jobResult, modelConfig, result, type)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                biz,
                title,
                "queue",
                Date.now(),
                serverName,
                serverTitle,
                serverVersion,
                JSON.stringify(taskParam),
                JSON.stringify({}),
                JSON.stringify(modelConfig),
                JSON.stringify({}),
                1,
            ],
        );
        const taskId = String(taskDbId);
        sendJson(res, 200, { code: 0, data: { taskId } });
        Events.callPage("main", "httpserver:submitTask", {
            biz,
            taskId,
        }).catch((err) => {
            Log.error("httpserver.submitTask.error", err);
        });
    }),
);

// ── POST /api/model/query ────────────────────────────────────────────────
router.post(
    "/query",
    asyncHandler(async (req: Request, res: Response) => {
        const { taskId } = req.body || {};
        if (!taskId) {
            sendJson(res, 400, { code: -1, msg: "Missing taskId" });
            return;
        }
        const queryOnce = async () => {
            const record = await DBMain.first(
                "SELECT * FROM data_task WHERE id = ?",
                [taskId],
            );
            if (!record) {
                return {
                    done: true,
                    payload: {
                        code: 0,
                        data: { status: "error", error: "Task not found" },
                    },
                };
            }
            if (record.status === "success") {
                let result: any = null;
                try {
                    const parsed = JSON.parse(record.result);
                    if (parsed && Object.keys(parsed).length > 0)
                        result = parsed;
                } catch (_) {}
                if (result) {
                    return {
                        done: true,
                        payload: {
                            code: 0,
                            data: {
                                status: "success",
                                result: {
                                    code: 0,
                                    msg: "ok",
                                    data: {
                                        type: "success",
                                        start: record.startTime || 0,
                                        end: record.endTime || 0,
                                        data: result,
                                    },
                                },
                            },
                        },
                    };
                }
            } else if (record.status === "fail") {
                return {
                    done: true,
                    payload: {
                        code: 0,
                        data: {
                            status: "error",
                            error: record.statusMsg || "Task failed",
                        },
                    },
                };
            } else if (record.status === "pause") {
                let jobResult: any = null;
                try {
                    jobResult = JSON.parse(record.jobResult);
                } catch (_) {}
                return {
                    done: true,
                    payload: {
                        code: 0,
                        data: {
                            status: "pause",
                            taskId: String(record.id),
                            step: jobResult?.step || null,
                            statusMsg: record.statusMsg || "Task paused",
                        },
                    },
                };
            }
            return { done: false, payload: null };
        };
        const { finished, result } = await pollQuery(queryOnce, {
            timeoutMs: 60_000,
            intervalMs: 500,
        });
        if (finished && result) {
            sendJson(res, 200, result);
        } else {
            sendJson(res, 200, { code: 0, data: { status: "pending" } });
        }
    }),
);

export default router;
