import { t } from "../../../lang";
import { TaskRecord, TaskService } from "../../../service/TaskService";
import { TaskChangeType, useTaskStore } from "../../../store/modules/task";
import { TaskRunResult } from "./type";

const taskStore = useTaskStore();

/**
 * 将单个文件复制到软件自身存储（hub 目录）。
 * - 已是 hub 文件：直接返回原路径；
 * - 远程地址（http/https）：先下载到临时文件再入库；
 * - 本地文件（模型服务器输出）：直接复制入库；
 * - 复制失败（文件不存在等）：保留原值返回，不阻塞任务成功。
 */
const hubSaveOneFile = async (file: string): Promise<string> => {
    if (!file || typeof file !== "string") {
        return file;
    }
    try {
        if (await window.$mapi.file.isHubFile(file)) {
            return file;
        }
    } catch (e) {
        /* ignore */
    }
    try {
        if (/^https?:\/\//i.test(file)) {
            const tempPath = await window.$mapi.file.temp("bin", "download");
            try {
                await window.$mapi.file.download(file, tempPath, {
                    isDataPath: false,
                });
                return await window.$mapi.file.hubSave(tempPath);
            } finally {
                await window.$mapi.file.deletes(tempPath, {
                    isDataPath: false,
                });
            }
        }
        return await window.$mapi.file.hubSave(file);
    } catch (e) {
        // 文件不存在或复制失败：保留原值，避免任务整体失败
        window.$mapi.log.error("hubSaveOneFile.skip", {
            file,
            error: String(e),
        });
        return file;
    }
};

/**
 * 将通用模型 / 通用 ComfyUI 任务结果中的文件字段复制到软件自身存储（hub）。
 *
 * 模型服务器生成的结果文件位于服务器目录，删除服务或重新安装后文件会丢失；
 * 通过本函数在任务成功时把文件归档到 AIGCPanel 软件 hub 存储，保证结果长期可用。
 *
 * 输出类型仅三种：file（单文件）、files（多文件）、text（文本）。
 * - 有 resultDef（config.json general[].result 定义数组）：
 *   仅处理 type 为 file / files 的字段（file 值为文件路径字符串，files 值为
 *   文件路径数组），其余字段（text 等）原样保留；
 * - 无 resultDef：递归扫描全部字段，字符串值会尝试归档（本地文件路径 / http 地址
 *   会被复制入库；普通文字字符串保留不变），文字类字段（text/records/msg 等）跳过。
 *
 * 返回新结果对象，原对象不被修改。
 */
export const hubSaveResultFiles = async (
    result: any,
    resultDef?: any[],
): Promise<any> => {
    if (!result || typeof result !== "object" || Array.isArray(result)) {
        return result;
    }
    // 有 resultDef：按定义精确处理 file / files 字段
    if (Array.isArray(resultDef) && resultDef.length > 0) {
        const fileFieldNames = new Set<string>();
        for (const def of resultDef) {
            if (
                def &&
                (def.type === "file" || def.type === "files") &&
                def.name
            ) {
                fileFieldNames.add(def.name);
            }
        }
        const newResult: any = { ...result };
        for (const name of fileFieldNames) {
            const value = newResult[name];
            if (value == null) {
                continue;
            }
            if (Array.isArray(value)) {
                const saved: string[] = [];
                for (const v of value) {
                    saved.push(await hubSaveOneFile(v));
                }
                newResult[name] = saved;
            } else if (typeof value === "string") {
                newResult[name] = await hubSaveOneFile(value);
            }
        }
        return newResult;
    }
    // 无 resultDef：递归扫描，文件字段归档、文字字段保留
    return await hubSaveObjectDeep(result);
};

// 已知纯文字字段（不做文件归档处理）
const SKIP_TEXT_FIELDS = new Set([
    "text",
    "records",
    "msg",
    "error",
    "prompt",
    "title",
    "description",
    "name",
]);

const hubSaveValueDeep = async (v: any): Promise<any> => {
    if (typeof v === "string") {
        return await hubSaveOneFile(v);
    }
    if (Array.isArray(v)) {
        const saved: any[] = [];
        for (const item of v) {
            saved.push(await hubSaveValueDeep(item));
        }
        return saved;
    }
    if (v && typeof v === "object") {
        return await hubSaveObjectDeep(v);
    }
    return v;
};

const hubSaveObjectDeep = async (obj: any): Promise<any> => {
    const newResult: any = {};
    for (const k in obj) {
        if (SKIP_TEXT_FIELDS.has(k)) {
            newResult[k] = obj[k];
            continue;
        }
        newResult[k] = await hubSaveValueDeep(obj[k]);
    }
    return newResult;
};

/**
 * 从通用任务结果中收集全部 hub 文件路径（字符串字段与数组元素）。
 * 供删除任务时清理归档文件使用（只收集 hub 中的文件，避免误删其他路径）。
 */
export const collectHubResultFiles = async (result: any): Promise<string[]> => {
    const candidates: string[] = [];
    const collect = (v: any) => {
        if (typeof v === "string") {
            candidates.push(v);
        } else if (Array.isArray(v)) {
            v.forEach(collect);
        }
    };
    collect(result);
    const files: string[] = [];
    for (const f of candidates) {
        try {
            if (await window.$mapi.file.isHubFile(f)) {
                files.push(f);
            }
        } catch (e) {
            /* ignore */
        }
    }
    return files;
};

export const createTaskRunResult = async (
    taskId: string,
    successCallback: (data: Record<string, any>, task: TaskRecord) => void,
) => {
    const task = await TaskService.get(taskId);
    if (!task) {
        throw t("error.taskNotFound");
    }
    const biz = task.biz;
    return () => {
        return new Promise<TaskRunResult>((resolve) => {
            const callback = (bizId: string, type: TaskChangeType) => {
                if (bizId !== taskId) {
                    return;
                }
                TaskService.get(bizId)
                    .then((task) => {
                        if (!task) {
                            resolve({ code: -1, msg: t("error.taskNotFound") });
                            taskStore.offChange(biz, callback);
                            return;
                        }
                        if (task.status === "success") {
                            const data = { status: "success" };
                            successCallback(data, task);
                            resolve({
                                code: 0,
                                msg: "ok",
                                data: data,
                            } as TaskRunResult);
                            taskStore.offChange(biz, callback);
                            return;
                        }
                        if (task.status === "pause") {
                            resolve({
                                code: 0,
                                msg: "",
                                data: { status: "pause" },
                            });
                            taskStore.offChange(biz, callback);
                            return;
                        }
                        if (task.status === "fail") {
                            resolve({
                                code: -1,
                                msg: task.statusMsg || t("error.taskFailed"),
                            });
                            taskStore.offChange(biz, callback);
                            return;
                        }
                    })
                    .catch((error) => {
                        resolve({
                            code: -1,
                            msg: "" + error || t("error.getTaskFailed"),
                        });
                        taskStore.offChange(biz, callback);
                    });
            };
            taskStore.onChange(biz, callback);
            callback(taskId, null!);
        });
    };
};
