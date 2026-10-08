import { Router } from "express";
import type { Request, Response } from "express";
import { StorageMain } from "../../storage/main";
import { DBMain } from "../../db/main";
import { Events } from "../../event/main";
import { Log } from "../../log/main";
import { AppEnv } from "../../env";

import fs from "node:fs";
import path from "node:path";
import {
    sendJson,
    asyncHandler,
    pollQuery,
    functionArgsMap,
    functionBizMap,
} from "../utils";
import ServerApi from "../../server/api";
import { ServerMain } from "../../server/main";

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Read config.json from a local model directory and build a server record,
 * mirroring the LOCAL_DIR import flow used by ServerAddDialog.vue.
 */
const buildRecordFromDir = async (localPath: string): Promise<any> => {
    // ComfyUI 模型：校验每个工作流 meta.json 均声明 biz 字段
    // （biz 标记工作流所属平台功能，通用工作流使用 "general"；缺失视为配置错误）
    const validateComfyUIWorkflowBiz = async (root: string) => {
        const workflowsRoot = path.join(root, "workflows");
        let entries: any[] = [];
        try {
            entries = await fs.promises.readdir(workflowsRoot, {
                withFileTypes: true,
            });
        } catch (e) {
            throw new Error(`cannot read workflows dir: ${e}`);
        }
        for (const ent of entries) {
            if (!ent.isDirectory()) {
                continue;
            }
            const metaPath = path.join(workflowsRoot, ent.name, "meta.json");
            let meta: any = {};
            try {
                const content = await fs.promises.readFile(metaPath, "utf-8");
                meta = JSON.parse(content);
            } catch (e) {
                throw new Error(
                    `invalid meta.json: workflows/${ent.name}/meta.json (${e})`,
                );
            }
            if (!meta.biz) {
                throw new Error(
                    `workflow meta.json missing biz: workflows/${ent.name}/meta.json（工作流必须声明 biz 字段标记所属平台功能，通用工作流使用 "general"）`,
                );
            }
        }
    };
    const configPath = path.join(localPath, "config.json");
    let content = "";
    try {
        content = await fs.promises.readFile(configPath, "utf-8");
    } catch (e) {
        throw new Error(`cannot read config.json: ${e}`);
    }
    let json: any;
    try {
        json = JSON.parse(content);
    } catch (e) {
        throw new Error(`invalid config.json: ${e}`);
    }
    if (!json.name || !json.version) {
        throw new Error("config.json missing name/version");
    }
    // ComfyUI 模型导入时校验全部工作流 biz 字段（缺失即报错）
    if (json.type === "comfyui") {
        await validateComfyUIWorkflowBiz(localPath);
    }
    return {
        key: `${json.name}|${json.version}`,
        name: json.name,
        title: json.title || json.name,
        version: json.version,
        type: "localDir",
        // EasyServer（含 ComfyUI，其 entry 亦为 __EasyServer__）默认自启动
        autoStart: json.entry === "__EasyServer__",
        functions: json.functions || [],
        localPath,
        settings: json.settings || [],
        setting: json.setting || {},
        config: json,
    };
};

const getInstalledServers = async () => {
    const storageData = await StorageMain.read("server", null);
    const records = storageData?.records || [];
    return records
        .filter((r: any) => r.name && r.version)
        .map((r: any) => {
            // ComfyUI 模型确保存在 comfyui 功能（CLI serverCall 可用）
            let funcNames: string[] = (r.functions || []).map(String);
            if (
                r.config?.type === "comfyui" &&
                !funcNames.includes("comfyui")
            ) {
                funcNames = [...funcNames, "comfyui"];
            }
            return {
                id: `${r.name}|${r.version}`,
                name: r.name,
                version: r.version,
                title: r.title || r.name,
                functions: funcNames.map((funcName: string) => ({
                    name: funcName,
                    args: functionArgsMap[funcName] || [],
                    param: r.config?.functions?.[funcName]?.param || [],
                })),
            };
        });
};

/**
 * 按服务器标识解析记录：`server` 支持 "name|version" 或仅 "name"。
 * - 仅名称时按名称匹配：匹配到唯一版本 → 返回该记录
 * - 匹配到多个版本 → 报错要求必须传递版本号
 * - 无匹配 → 报错
 */
const resolveServerRecord = async (serverKey: string) => {
    const [serverName, serverVersion = ""] = String(serverKey || "").split("|");
    const storageData = await StorageMain.read("server", null);
    const records = storageData?.records || [];
    if (serverVersion) {
        const record = records.find(
            (r: any) => r.name === serverName && r.version === serverVersion,
        );
        if (!record) {
            throw new Error(`Server not found: ${serverName}|${serverVersion}`);
        }
        return record;
    }
    const matched = records.filter((r: any) => r.name === serverName);
    if (matched.length === 0) {
        throw new Error(`Server not found: ${serverName}`);
    }
    if (matched.length > 1) {
        const versions = matched.map((r: any) => r.version).join(", ");
        throw new Error(
            `Multiple versions found for "${serverName}" (${versions}), please specify version`,
        );
    }
    return matched[0];
};

const buildModelConfig = (
    funcName: string,
    serverName: string,
    serverTitle: string,
    serverVersion: string,
    param: any,
    serverRecord?: any,
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
        case "textToVideo":
            return {
                prompt: param?.prompt || "",
                textToVideo: {
                    serverName,
                    serverTitle,
                    serverVersion,
                    type: "TextToVideo",
                    serverKey: `${serverName}|${serverVersion}`,
                    param: param?.param || {},
                },
            };
        case "imageToVideo":
            return {
                images: param?.images || [],
                prompt: param?.prompt || "",
                imageToVideo: {
                    serverName,
                    serverTitle,
                    serverVersion,
                    type: "ImageToVideo",
                    serverKey: `${serverName}|${serverVersion}`,
                    param: param?.param || {},
                },
            };
        case "comfyui": {
            // 模型端自动识别上传，无需特殊输入字段。 // 输入统一由 param 普通对象承载（image/video 等文件路径作为字段值）， // JSON 整体传递（--param '{"width":320}' 或 --paramJson 文件）。 // 通用 ComfyUI 工作流调用：comfyuiName 选择工作流，参数用
            const extra: Record<string, any> = { ...(param || {}) };
            delete extra.comfyuiName;
            delete extra.param;
            return {
                type: "GeneralComfyUI",
                serverKey: `${serverName}|${serverVersion}`,
                param: Object.assign(
                    { comfyuiName: param?.comfyuiName || "" },
                    extra,
                    param?.param || {},
                ),
            };
        }
        case "general": {
            // 通用模型（与前端"通用模型"工具一致的 modelConfig 结构）：
            // --function general 表示调用平台通用模型方法，具体能力名通过
            // param.generalName 传入（如 generalImage），param 其余字段原样透传；
            // result 定义从 serverRecord.config.general 中按 generalName 查找。
            const funcName = String(param?.generalName || "general");
            let resultDef: any[] = [];
            const generalDefs = serverRecord?.config?.general || [];
            for (const def of generalDefs) {
                if (def?.name === funcName) {
                    resultDef = def?.result || [];
                    break;
                }
            }
            const cleanParam: Record<string, any> = { ...(param || {}) };
            delete cleanParam.generalName;
            return {
                type: "GeneralModel",
                serverKey: `${serverName}|${serverVersion}`,
                funcName,
                param: cleanParam,
                resultDef,
            };
        }
        default:
            return param || {};
    }
};

const buildTaskParam = (funcName: string, param: any) => {
    if (
        funcName === "videoGen" ||
        funcName === "asr" ||
        funcName === "comfyui"
    ) {
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
                : "音色复刻任务";
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
        case "textToVideo":
            return param?.prompt
                ? String(param.prompt).slice(0, 20)
                : "文生视频任务";
        case "imageToVideo":
            return param?.prompt
                ? String(param.prompt).slice(0, 20)
                : "图生视频任务";
        case "comfyui":
            return "ComfyUI 工作流任务";
        case "general":
            return param?.prompt
                ? String(param.prompt).slice(0, 20)
                : "通用模型任务";
        default:
            return "任务";
    }
};

// ── POST /api/server/list ────────────────────────────────────────────────
router.post(
    "/list",
    asyncHandler(async (_req: Request, res: Response) => {
        const servers = await getInstalledServers();
        sendJson(res, 200, { code: 0, data: servers });
    }),
);

// ── POST /api/server/call ────────────────────────────────────────────────
router.post(
    "/call",
    asyncHandler(async (req: Request, res: Response) => {
        let { server, function: funcName, param, env } = req.body || {};
        // 透传 AIGCPANEL_* 环境变量到服务进程（如 AIGCPANEL_SKIP_LONG 测试开关）
        if (env && typeof env === "object") {
            ServerApi.setExtraEnv(env);
        }
        // server 支持 "name" 或 "name|version"，version 可省略
        const [serverName, serverVersion = ""] = String(server || "").split(
            "|",
        );
        if (!serverName) {
            sendJson(res, 400, {
                code: -1,
                msg: "Missing server",
            });
            return;
        }
        if (!funcName) {
            sendJson(res, 400, { code: -1, msg: "Missing function" });
            return;
        }
        let serverRecord: any;
        try {
            serverRecord = await resolveServerRecord(
                serverName + (serverVersion ? `|${serverVersion}` : ""),
            );
        } catch (e) {
            sendJson(res, 400, { code: -1, msg: String(e) });
            return;
        }
        const resolvedVersion = serverRecord.version;
        // comfyui：按所选工作流的 meta.biz 归类任务——
        // 任务 biz 与 modelConfig 均按对应平台功能构建（文生图/图生图/文生视频等），
        // 使任务出现在客户端对应功能任务列表且按该功能流程调度执行；
        // biz=general 或未知归入通用 ComfyUI（保持 GeneralComfyUI 流程）
        let effectiveFunc = funcName;
        if (funcName === "comfyui") {
            const workflowBizToFunc: Record<string, string> = {
                general: "comfyui",
                textToImage: "textToImage",
                imageToImage: "imageToImage",
                textToVideo: "textToVideo",
                imageToVideo: "imageToVideo",
                videoGen: "videoGen",
                asr: "asr",
                soundTts: "soundTts",
                soundClone: "soundClone",
            };
            let wfBiz = "";
            try {
                const metaPath = path.join(
                    serverRecord.localPath || "",
                    "workflows",
                    param?.comfyuiName || "",
                    "meta.json",
                );
                const content = await fs.promises.readFile(metaPath, "utf-8");
                wfBiz = JSON.parse(content).biz || "";
            } catch (e) {
                /* comfyuiName 对应工作流不存在或读取失败：按通用 ComfyUI 处理 */
            }
            effectiveFunc = workflowBizToFunc[wfBiz] || "comfyui";
            if (effectiveFunc !== "comfyui") {
                // comfyui 参数结构（{comfyuiName, param:{...业务参数}}）
                // 转换为对应功能分支结构：业务参数提升到顶层，comfyuiName 注入 param
                const inner = {
                    ...(param?.param || {}),
                    comfyuiName: param?.comfyuiName || "",
                };
                param = { ...inner };
                param.param = inner;
            }
        }
        const biz = functionBizMap[effectiveFunc];
        if (!biz) {
            sendJson(res, 400, {
                code: -1,
                msg: `Unknown function: ${effectiveFunc}`,
            });
            return;
        }
        const serverTitle = serverRecord.title || serverName;
        const modelConfig = buildModelConfig(
            effectiveFunc,
            serverName,
            serverTitle,
            resolvedVersion,
            param,
            serverRecord,
        );
        const taskParam = buildTaskParam(effectiveFunc, param);
        const title = buildTaskTitle(effectiveFunc, param);
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
                resolvedVersion,
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

// ── POST /api/server/query ───────────────────────────────────────────────
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

// ── POST /api/server/log ─────────────────────────────────────────────────
// 查看模型服务日志（logs 目录中 {name}_{version}_*.log 最新文件，最多返回后 100KB）
router.post(
    "/log",
    asyncHandler(async (req: Request, res: Response) => {
        const { server } = req.body || {};
        if (!server) {
            sendJson(res, 400, { code: -1, msg: "Missing server" });
            return;
        }
        let serverRecord: any;
        try {
            serverRecord = await resolveServerRecord(String(server));
        } catch (e) {
            sendJson(res, 400, { code: -1, msg: String(e) });
            return;
        }
        const logDir = path.join(AppEnv.dataRoot, "logs");
        let files: string[] = [];
        try {
            if (fs.existsSync(logDir)) {
                files = fs
                    .readdirSync(logDir)
                    .filter(
                        (f) =>
                            f.startsWith(
                                `${serverRecord.name}_${serverRecord.version}`,
                            ) && f.endsWith(".log"),
                    )
                    .sort();
            }
        } catch (e) {
            Log.error("httpserver.serverLog.error", String(e));
        }
        if (files.length === 0) {
            sendJson(res, 200, {
                code: 0,
                data: { file: null, content: "" },
            });
            return;
        }
        const latest = files[files.length - 1];
        let content = "";
        try {
            content = fs.readFileSync(path.join(logDir, latest), "utf-8");
            if (content.length > 100 * 1024) {
                content = content.slice(-100 * 1024);
            }
        } catch (e) {
            Log.error("httpserver.serverLog.read.error", String(e));
        }
        sendJson(res, 200, {
            code: 0,
            data: { file: latest, content },
        });
    }),
);

// ── POST /api/server/setting ─────────────────────────────────────────────
// 设置模型服务参数（合并到 server record 的 setting，如 gpu / idleTimeout）
router.post(
    "/setting",
    asyncHandler(async (req: Request, res: Response) => {
        const { server, setting } = req.body || {};
        if (!server) {
            sendJson(res, 400, { code: -1, msg: "Missing server" });
            return;
        }
        if (!setting || typeof setting !== "object") {
            sendJson(res, 400, { code: -1, msg: "Missing setting object" });
            return;
        }
        let serverRecord: any;
        try {
            serverRecord = await resolveServerRecord(String(server));
        } catch (e) {
            sendJson(res, 400, { code: -1, msg: String(e) });
            return;
        }
        const storageData = (await StorageMain.read("server", null)) || {};
        const records = Array.isArray(storageData.records)
            ? storageData.records
            : [];
        const index = records.findIndex(
            (r: any) =>
                r.name === serverRecord.name &&
                r.version === serverRecord.version,
        );
        if (index < 0) {
            sendJson(res, 400, {
                code: -1,
                msg: `Server not found: ${serverRecord.name}|${serverRecord.version}`,
            });
            return;
        }
        records[index] = Object.assign({}, records[index], {
            setting: Object.assign(records[index].setting || {}, setting),
        });
        await StorageMain.set("server", "records", records);
        Events.callPage("main", "httpserver:serverReload", {}).catch((err) => {
            Log.error("httpserver.serverSetting.reload.error", err);
        });
        sendJson(res, 200, { code: 0, data: records[index].setting });
    }),
);

// ── POST /api/server/workflows ───────────────────────────────────────────
// 获取 ComfyUI 模型的工作流列表（PRO 构建中 VIP 模式可用；读取 workflows/*/meta.json）
router.post(
    "/workflows",
    asyncHandler(async (req: Request, res: Response) => {
        const { server } = req.body || {};
        if (!server) {
            sendJson(res, 400, { code: -1, msg: "Missing server" });
            return;
        }
        let serverRecord: any;
        try {
            serverRecord = await resolveServerRecord(String(server));
        } catch (e) {
            sendJson(res, 400, { code: -1, msg: String(e) });
            return;
        }
        // 仅 ComfyUI 模型支持工作流
        if (serverRecord.config?.type !== "comfyui") {
            sendJson(res, 400, {
                code: -1,
                msg: "Server is not a ComfyUI model",
            });
            return;
        }
        
        // 读取 workflows/*/meta.json
        const wfRoot = path.join(serverRecord.localPath, "workflows");
        const workflows: any[] = [];
        try {
            if (fs.existsSync(wfRoot)) {
                const dirs = fs
                    .readdirSync(wfRoot, { withFileTypes: true })
                    .filter((d) => d.isDirectory());
                for (const dir of dirs) {
                    const metaPath = path.join(wfRoot, dir.name, "meta.json");
                    if (!fs.existsSync(metaPath)) continue;
                    try {
                        const meta = JSON.parse(
                            fs.readFileSync(metaPath, "utf-8"),
                        );
                        const userWf = path.join(
                            wfRoot,
                            dir.name,
                            "workflow.user.json",
                        );
                        workflows.push({
                            key: meta.name || dir.name,
                            title: meta.title || meta.name || dir.name,
                            description: meta.description || "",
                            param: meta.param || [],
                            biz: meta.biz || "",
                            hasUserConfig: fs.existsSync(userWf),
                        });
                    } catch (e) {
                        Log.error(
                            "httpserver.serverWorkflows.meta.error",
                            String(e),
                        );
                    }
                }
            }
        } catch (e) {
            Log.error("httpserver.serverWorkflows.error", String(e));
        }
        sendJson(res, 200, {
            code: 0,
            data: {
                
                workflows,
            },
        });
    }),
);

// ── POST /api/server/install ─────────────────────────────────────────────
// Install (upsert) a model server from a local directory.
// Body: { path: "/abs/path/to/model-dir" }  (must contain config.json)
router.post(
    "/install",
    asyncHandler(async (req: Request, res: Response) => {
        const { path: localPath } = req.body || {};
        if (!localPath || typeof localPath !== "string") {
            sendJson(res, 400, { code: -1, msg: "Missing path" });
            return;
        }
        let record: any;
        try {
            record = await buildRecordFromDir(localPath);
        } catch (e) {
            sendJson(res, 400, { code: -1, msg: String(e) });
            return;
        }
        const storageData = (await StorageMain.read("server", null)) || {};
        const records = Array.isArray(storageData.records)
            ? storageData.records
            : [];
        const index = records.findIndex(
            (r: any) => r.name === record.name && r.version === record.version,
        );
        if (index >= 0) {
            records[index] = record;
        } else {
            records.push(record);
        }
        await StorageMain.set("server", "records", records);
        Log.info("httpserver.serverInstall", {
            name: record.name,
            version: record.version,
            localPath,
        });
        Events.callPage("main", "httpserver:serverReload", {}).catch((err) => {
            Log.error("httpserver.serverInstall.reload.error", err);
        });
        sendJson(res, 200, { code: 0, data: record });
    }),
);

// ── POST /api/server/remove ──────────────────────────────────────────────
// Remove an installed server record.
// Body: { server: "name" or "name|version" }  version 可省略（按名称匹配唯一记录）
router.post(
    "/remove",
    asyncHandler(async (req: Request, res: Response) => {
        const { server } = req.body || {};
        if (!server) {
            sendJson(res, 400, { code: -1, msg: "Missing server" });
            return;
        }
        const [name, version = ""] = String(server).split("|");
        const storageData = (await StorageMain.read("server", null)) || {};
        const records = Array.isArray(storageData.records)
            ? storageData.records
            : [];
        let matched: any;
        if (version) {
            matched = records.find(
                (r: any) => r.name === name && r.version === version,
            );
        } else {
            const matches = records.filter((r: any) => r.name === name);
            if (matches.length > 1) {
                const versions = matches.map((r: any) => r.version).join(", ");
                sendJson(res, 400, {
                    code: -1,
                    msg: `Multiple versions found for "${name}" (${versions}), please specify version`,
                });
                return;
            }
            matched = matches[0];
        }
        const removed = matched;
        const next = records.filter(
            (r: any) =>
                !(r.name === removed?.name && r.version === removed?.version),
        );
        // 删除记录前先停止运行中的服务（避免进程残留）
        if (removed) {
            try {
                await ServerMain.stopServer({
                    localPath: removed.localPath || "",
                    name: removed.name,
                    version: removed.version,
                    type: removed.type || "localDir",
                    setting: removed.setting || {},
                    logFile: "",
                    eventChannelName: "",
                    config: removed.config || {},
                } as any);
            } catch (e) {
                Log.error("httpserver.serverRemove.stop.error", String(e));
            }
        }
        await StorageMain.set("server", "records", next);
        Events.callPage("main", "httpserver:serverReload", {}).catch((err) => {
            Log.error("httpserver.serverRemove.reload.error", err);
        });
        sendJson(res, 200, {
            code: 0,
            data: { removed: records.length - next.length },
        });
    }),
);

export default router;
