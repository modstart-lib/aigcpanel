import { Router } from "express";
import type { Request, Response } from "express";
import { StorageMain } from "../../storage/main";
import { sendJson, asyncHandler, functionArgsMap } from "../utils";

const router = Router();

/**
 * 获取已安装的模型服务完整列表（含完整参数定义）
 */
const getInstalledServers = async () => {
    const storageData = await StorageMain.read("server", null);
    const records = storageData?.records || [];
    return records
        .filter((r: any) => r.name && r.version)
        .map((r: any) => {
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
                type: r.type || r.config?.type || "local",
                description: r.config?.description || "",
                functions: funcNames.map((funcName: string) => ({
                    name: funcName,
                    args: functionArgsMap[funcName] || [],
                    param: r.config?.functions?.[funcName]?.param || [],
                })),
                settings: (r.settings || []).map((s: any) => ({
                    name: s.name,
                    title: s.title,
                    type: s.type,
                    default: s.default,
                    placeholder: s.placeholder || "",
                    options: s.options || [],
                    hint: s.hint || "",
                })),
                config: {
                    type: r.config?.type || "",
                    entry: r.config?.entry || "",
                    description: r.config?.description || "",
                    deviceDescription: r.config?.deviceDescription || "",
                    minDisk: r.config?.minDisk || "",
                    minMemory: r.config?.minMemory || "",
                    minGpu: r.config?.minGpu || "",
                    minGpuMemory: r.config?.minGpuMemory || "",
                },
            };
        });
};

/**
 * 按服务器标识解析记录
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

// ── POST /api/model/list ──────────────────────────────────────────────────
// 获取已安装的服务列表（精简版，兼容旧版调用）

router.post(
    "/list",
    asyncHandler(async (_req: Request, res: Response) => {
        const servers = await getInstalledServers();
        // 保持兼容：返回精简结构和完整数据
        const list = servers.map((s: any) => ({
            id: s.id,
            name: s.name,
            version: s.version,
            title: s.title,
            functions: s.functions,
        }));
        sendJson(res, 200, { code: 0, data: list });
    }),
);

// ── POST /api/model/info ──────────────────────────────────────────────────
// 获取指定模型的完整参数信息（含所有字段定义、设置项、硬件要求等）
// Body: { server: "name|version" }  或  { server: "name" }

router.post(
    "/info",
    asyncHandler(async (req: Request, res: Response) => {
        const { server } = req.body || {};
        if (!server) {
            sendJson(res, 400, { code: -1, msg: "Missing server" });
            return;
        }
        let record: any;
        try {
            record = await resolveServerRecord(String(server));
        } catch (e) {
            sendJson(res, 400, { code: -1, msg: String(e) });
            return;
        }

        const funcNames: string[] = (record.functions || []).map(String);
        if (
            record.config?.type === "comfyui" &&
            !funcNames.includes("comfyui")
        ) {
            funcNames.push("comfyui");
        }

        // 构建 functions 详细信息
        const functions = funcNames.map((funcName: string) => {
            const funcDef = record.config?.functions?.[funcName] || {};
            const paramList = funcDef.param || [];
            return {
                name: funcName,
                title: funcDef.title || funcName,
                description: funcDef.description || "",
                args: functionArgsMap[funcName] || [],
                // 参数定义：每个参数的名称、标题、类型、默认值、选项等
                param: paramList.map((p: any) => ({
                    name: p.name,
                    title: p.title,
                    type: p.type || "text",
                    default: p.defaultValue ?? p.default ?? "",
                    placeholder: p.placeholder || "",
                    required: p.required ?? false,
                    options: p.options || [],
                    hint: p.hint || "",
                    min: p.min,
                    max: p.max,
                })),
                // 返回结果定义（如有）
                result: (funcDef.result || []).map((r: any) => ({
                    name: r.name,
                    title: r.title,
                    type: r.type || "string",
                    description: r.description || "",
                })),
            };
        });

        // 构建设置项
        const settings = (record.settings || []).map((s: any) => ({
            name: s.name,
            title: s.title,
            type: s.type,
            default: s.default ?? s.defaultValue ?? "",
            placeholder: s.placeholder || "",
            options: s.options || [],
            hint: s.hint || "",
        }));

        sendJson(res, 200, {
            code: 0,
            data: {
                id: `${record.name}|${record.version}`,
                name: record.name,
                version: record.version,
                title: record.title || record.name,
                description: record.config?.description || "",
                type: record.type || record.config?.type || "local",
                // 硬件要求
                requirements: {
                    minDisk: record.config?.minDisk || "",
                    minMemory: record.config?.minMemory || "",
                    minGpu: record.config?.minGpu || "",
                    minGpuMemory: record.config?.minGpuMemory || "",
                    deviceDescription: record.config?.deviceDescription || "",
                },
                // 功能列表及参数
                functions,
                // 模型设置项
                settings,
                // 原始 config（完整引用）
                config: {
                    entry: record.config?.entry || "",
                    cloudName: record.config?.cloudName || "",
                    autoStart: !!record.autoStart,
                },
            },
        });
    }),
);

export default router;
