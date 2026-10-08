import {
    SendType,
    ServerApiType,
    ServerContext,
    ServerInfo,
} from "../mapi/server/type";
import { Files } from "../mapi/file/main";
import { Log } from "../mapi/log/main";
import { EncodeUtil } from "../lib/util";
import { t } from "../config/lang";


/**
 * ComfyUI 服务器管理（type=comfyui 的模型服务）
 *
 * 通过 launcher 以 watch 常驻模式启动：
 *   - 启动时动态分配端口（AIGCPANEL_SERVER_PORT），避免多个 comfyui 冲突
 *   - 服务常驻，通过 aigcpanel-queue/*.queue.json 通讯下发工作流任务
 *   - 任务结果通过 launcher stdout 标准输出（AigcPanelRunResult[<id>][<base64>]）返回
 *   - url() 返回 ComfyUI Web UI 地址，供 BrowserWindow 查看
 */
/**
 * 将服务端 meta.json 的参数定义转换为平台参数表单（ParamForm）兼容格式。
 *
 * 服务端约定 type：string / textarea / number / select（+ options）
 * ParamForm 约定 type：input / textarea / inputNumber / select / switch / slider / speaker
 * 映射：string -> input，textarea -> textarea，number -> inputNumber，select 保持；
 * 并补全可选字段（icon/placeholder/required/tips），seed 自动带随机按钮（opt:["seed"]）。
 * 长文本型参数（如 negativePrompt / description 明显的）自动用 textarea。
 */
function normalizeWorkflowParams(params: any[]): any[] {
    return (params || []).map((p: any) => {
        const base = {
            name: p.name,
            title: p.title || p.name,
            icon: p.icon || "",
            defaultValue: p.defaultValue,
            placeholder: p.placeholder || "",
            required: !!p.required,
            tips: p.tips || p.description || "",
        };
        if (p.type === "select" || Array.isArray(p.options)) {
            return {
                ...base,
                type: "select",
                options: p.options || [],
            };
        }
        if (p.type === "number" || p.type === "inputNumber") {
            return {
                ...base,
                type: "inputNumber",
                min: p.min,
                max: p.max,
                step: p.step,
                opt: p.opt || (p.name === "seed" ? ["seed"] : []),
            };
        }
        // 长文本参数（负面提示词等）用多行文本框
        if (
            p.type === "textarea" ||
            /negative|prompt|text|desc|content/i.test(p.name)
        ) {
            return {
                ...base,
                type: "textarea",
                opt: p.opt || [],
            };
        }
        // string 等默认按单行输入框
        return {
            ...base,
            type: "input",
            opt: p.opt || [],
        };
    });
}

export const ComfyUIServer = function (config: any = null): ServerContext {
    // 每实例状态（闭包隔离）：多个 ComfyUI 模型各自独立，避免共享状态污染
    // （port 残留导致 ping 误判、任务结果串号、进程句柄互踩等）
    const serverRuntime = { port: 0 };
    let shellController = null;
    let isRunning = false;
    // 服务进程是否已退出（launcher 进程 success/error 回调触发）。
    // 任务等待结果期间若进程退出且无结果，说明任务未被消费（如空闲退出竞态），
    // 提前失败避免任务无限等待；每次启动时重置。
    let shellExited = false;
    // 启动中标志：多个任务并发触发懒启动时只启动一次，
    // 其余调用等待 ping 就绪即可（避免多个服务进程互杀）
    let starting = false;
    // 任务结果缓存：taskId -> result（从 launcher stdout 标准输出解析）
    const taskResults: {
        [taskId: string]: {
            result: any;
            endTime: number;
        };
    } = {};

    // 从 stdout 数据流中解析 AigcPanelRunResult[<id>][<base64>] 结果，
    // 合并到 taskResults（合并而非覆盖，避免 Device 环境信息 / End 标记
    // 把业务结果 url 覆盖掉）
    const extractResultFromStdout = (data: string): void => {
        if (!data) return;
        const regex = /AigcPanelRunResult\[([^\]]+)\]\[(.*?)\]/g;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(data)) !== null) {
            const taskId = match[1];
            const b64 = match[2];
            try {
                const result = JSON.parse(EncodeUtil.base64Decode(b64));
                const cached = taskResults[taskId];
                taskResults[taskId] = {
                    result: Object.assign(cached ? cached.result : {}, result),
                    endTime: Date.now(),
                };
            } catch (e) {
                Log.error("comfyui.extractResult.error", {
                    taskId,
                    error: String(e),
                });
            }
        }
    };

    return {
        ServerApi: null as ServerApiType | null,
        ServerInfo: null as ServerInfo | null,
        url() {
            // 使用 127.0.0.1 避免 localhost 解析到 IPv6 ::1 导致连接失败
            return `http://127.0.0.1:${serverRuntime.port}/`;
        },
        send(type: SendType, data: any) {
            this.ServerApi.event.sendChannel(this.ServerInfo.eventChannelName, {
                type,
                data,
            });
        },
        async init() {},
        async start() {
            if (starting) {
                // 已在启动中：多个任务并发触发懒启动时只启动一次，
                // 其余调用继续等待 ping 就绪即可
                return;
            }
            starting = true;
            try {
                await this._doStart();
            } finally {
                starting = false;
            }
        },
        async _doStart() {
            this.send("starting", this.ServerInfo);
            let command = [];
            // 动态分配端口（优先使用 setting.port，否则自动获取可用端口）
            serverRuntime.port = await this.ServerApi.availablePort(
                serverRuntime.port,
                this.ServerInfo.setting,
            );
            const env = await this.ServerApi.env();
            const launcher = `${this.ServerInfo.localPath}/launcher`;
            command.push(`"${launcher}"`);
            env["PATH"] = this.ServerApi.getPathEnv([
                `${this.ServerInfo.localPath}`,
                `${this.ServerInfo.localPath}/binary`,
            ]);
            env["PYTHONIOENCODING"] = "utf-8";
            // 动态端口注入，避免多实例冲突
            env["AIGCPANEL_SERVER_PORT"] = `${serverRuntime.port}`;
            
            // 空闲自动退出时间（秒）通过 launcherPrepareConfigJson 的 setting 通用传递
            // （config.setting.idleTimeout，服务端读取；默认 60，0 = 常驻不退出）
            // 开发模式跳过 launcher 登录检查（生产环境由平台认证，勿设置）
            env["AIGCPANEL_SERVER_DEV"] = "1";
            env["AIGCPANEL_SERVER_PLACEHOLDER_CONFIG"] =
                await this.ServerApi.launcherPrepareConfigJson({
                    id: "comfyui",
                    mode: { type: "watch", watchDelay: 3 },
                    modelConfig: {},
                    setting: this.ServerInfo.setting,
                });
            // console.log('command', JSON.stringify(command))
            shellExited = false; // 每次启动重置进程退出标志
            shellController = await this.ServerApi.app.spawnShell(command, {
                stdout: (data) => {
                    this.ServerApi.file.appendText(
                        this.ServerInfo.logFile,
                        data,
                        {
                            isDataPath: true,
                        },
                    );
                    // 从 stdout 标准输出解析任务结果
                    extractResultFromStdout(data);
                    const result = this.ServerApi.extractResultFromLogs(
                        "comfyui",
                        data,
                    );
                    if (result) {
                        if (result["Action"]) {
                            const action = result["Action"].split(":");
                            this.send("action", {
                                type: action[0],
                                msg: action.length > 1 ? action[1] : "",
                            });
                        }
                    }
                },
                stderr: (data) => {
                    this.ServerApi.file.appendText(
                        this.ServerInfo.logFile,
                        data,
                        {
                            isDataPath: true,
                        },
                    );
                },
                success: (data) => {
                    shellExited = true;
                    this.send("success", this.ServerInfo);
                },
                error: (data, code) => {
                    shellExited = true;
                    this.ServerApi.file.appendText(
                        this.ServerInfo.logFile,
                        data,
                        {
                            isDataPath: true,
                        },
                    );
                    this.send("error", this.ServerInfo);
                },
                env,
                cwd: this.ServerInfo.localPath,
            });
        },
        async ping() {
            if (!serverRuntime.port) {
                return false;
            }
            try {
                const res = await this.ServerApi.request(
                    `${this.url()}system_stats`,
                );
                return !!res && !!res["system"];
            } catch (e) {
                // console.log('ping error', e)
            }
            return false;
        },
        async stop() {
            this.send("stopping", this.ServerInfo);
            try {
                if (shellController) {
                    shellController.stop();
                    shellController = null;
                }
            } catch (e) {
                // console.log('stop error', e)
            }
            serverRuntime.port = 0;
            this.send("stopped", this.ServerInfo);
        },
        async cancel() {
            await this.ServerApi.launcherCancel(this);
        },
        async config() {
            // 读取服务端 workflows/*/meta.json，收集全部工作流
            // （每个工作流含 key/title/description/param/hasUserConfig/biz，
            // 供"流程管理"弹窗展示与调用界面选择工作流）
            type WorkflowItem = {
                key: string;
                title: string;
                description: string;
                param: any[];
                hasUserConfig: boolean;
                biz?: string;
            };
            const allWorkflows: WorkflowItem[] = [];
            try {
                const workflowsRoot = `${this.ServerInfo.localPath}/workflows`;
                const dirs = await Files.list(workflowsRoot, {
                    isDataPath: false,
                });
                for (const dir of dirs) {
                    if (!dir.isDirectory) {
                        continue;
                    }
                    const metaPath = `${dir.pathname}/meta.json`;
                    if (
                        !(await Files.exists(metaPath, { isDataPath: false }))
                    ) {
                        continue;
                    }
                    const metaContent = await Files.read(metaPath, {
                        isDataPath: false,
                    });
                    const meta = JSON.parse(metaContent);
                    // 是否已存在用户自定义版本（workflow.user.json）
                    const userWf = `${dir.pathname}/workflow.user.json`;
                    let hasUserConfig = false;
                    try {
                        hasUserConfig = await Files.exists(userWf, {
                            isDataPath: false,
                        });
                    } catch (e) {
                        /* ignore */
                    }
                    allWorkflows.push({
                        key: meta.name || dir.name,
                        title: meta.title || meta.name || dir.name,
                        description: meta.description || "",
                        // 参数定义转换为平台参数表单（ParamForm）兼容格式
                        param: normalizeWorkflowParams(meta.param || []),
                        hasUserConfig,
                        biz: meta.biz || "",
                    });
                }
            } catch (e) {
                Log.error("comfyui.config.workflows.error", String(e));
            }
            // 按平台功能（biz）分组工作流，供各功能调用界面选择
            const supportedBiz = [
                "general",
                "textToImage",
                "imageToImage",
                "textToVideo",
                "imageToVideo",
                "videoGen",
                "asr",
                "soundTts",
                "soundClone",
            ];
            const functions: Record<string, any> = {
                comfyui: { content: ``, param: [] },
            };
            for (const biz of supportedBiz) {
                const wfs = allWorkflows.filter((w) => w.biz === biz);
                functions[biz] = {
                    content: ``,
                    // 可选工作流列表（前端下拉选择，每个工作流不同参数）
                    workflows: wfs,
                    // 兼容：默认第一个工作流的参数
                    param: wfs[0]?.param || [],
                };
            }
            return {
                code: 0,
                msg: "ok",
                data: {
                    httpUrl: serverRuntime.port ? this.url() : null,
                    content: ``,
                    
                    // 全部工作流（ComfyUI 流程管理弹窗用）
                    workflows: allWorkflows,
                    functions,
                },
            };
        },

        // 恢复工作流默认：删除 workflows/<key>/workflow.user.json
        async restoreWorkflow(data: any) {
            const key = data?.comfyuiName || "";
            if (!key) {
                return { code: -1, msg: "comfyuiName required" };
            }
            const userWf = `${this.ServerInfo.localPath}/workflows/${key}/workflow.user.json`;
            let restored = false;
            try {
                if (await Files.exists(userWf, { isDataPath: false })) {
                    await Files.deletes(userWf, { isDataPath: false });
                    restored = true;
                }
            } catch (e) {
                return { code: -1, msg: String(e) };
            }
            return { code: 0, msg: "ok", data: { restored } };
        },

        // ---------- 工作流任务调用（通过 aigcpanel-queue + stdout 通讯） ----------

        /**
         * 结果解析：从服务端结果中提取 url（图片/视频/音频等文件结果）。
         */
        _resultUrlCalculator: async function (data: any, launcherResult: any) {
            if (!("url" in launcherResult.result)) {
                if (launcherResult.result.error) {
                    throw launcherResult.result.error;
                }
                if (launcherResult.result.msg) {
                    throw launcherResult.result.msg;
                }
                throw t("error.runFailedCheckLog");
            }
            return { url: launcherResult.result.url };
        },

        /**
         * 向 comfyui 服务下发工作流任务并等待结果。
         * 服务为 watch 常驻模式：任务写入 aigcpanel-queue/*.queue.json，
         * 结果从 launcher stdout 标准输出（AigcPanelRunResult[<id>][<base64>]）实时解析。
         */
        _callFunc: async function (
            data: any,
            configCalculator: (data: any) => Promise<any>,
            resultDataCalculator: (
                data: any,
                launcherResult: any,
            ) => Promise<any>,
            option?: { timeout: number },
        ) {
            option = Object.assign({ timeout: 24 * 3600 }, option);
            if (isRunning) {
                // 已有任务在执行：返回 retry，不写入 queue（避免任务堆积）
                return {
                    code: 0,
                    msg: "ok",
                    data: { type: "retry", start: 0, end: 0, data: {} },
                };
            }
            isRunning = true;
            const resultData = {
                type: "success",
                start: Date.now(),
                end: 0,
                data: {},
            };
            try {
                this.send("taskRunning", { id: data.id });
                // 清理旧缓存，避免同 taskId 残留结果命中
                delete taskResults[data.id];
                const configData = await configCalculator(data);
                configData.setting = this.ServerInfo.setting;
                // 写入 queue 文件（aigcpanel-queue/*.queue.json）
                const queueName = `${Date.now()}_${data.id}.queue.json`;
                const queuePath = `${this.ServerInfo.localPath}/aigcpanel-queue/${queueName}`;
                await Files.write(queuePath, JSON.stringify(configData), {
                    isDataPath: false,
                });
                this.ServerApi.file.appendText(
                    this.ServerInfo.logFile,
                    `Task queued: ${queueName}\n`,
                    { isDataPath: true },
                );

                // 等待结果：从 stdout 解析缓存中获取（AigcPanelRunResult[<id>]）
                // 仅当结果包含业务字段（url/error/msg/End）时视为完成，
                // 避免 resultEnv 输出的设备信息（Device）被误判为任务结果
                const startTime = Date.now();
                const timeoutMS = (option.timeout || 24 * 3600) * 1000;
                const launcherResult = { result: {}, endTime: null };
                const isBusinessResult = (r: any) =>
                    "url" in r || "error" in r || "msg" in r || "End" in r;
                while (Date.now() - startTime < timeoutMS) {
                    const cached = taskResults[data.id];
                    if (cached && isBusinessResult(cached.result)) {
                        Object.assign(launcherResult.result, cached.result);
                        launcherResult.endTime = cached.endTime;
                        this.send("taskResult", {
                            id: data.id,
                            result: launcherResult.result,
                        });
                        break;
                    }
                    // 服务进程已退出但任务未产生结果：任务未被消费（如空闲退出竞态），
                    // 提前失败避免任务无限等待（用户重试时服务会自动重启）
                    if (shellExited) {
                        this.ServerApi.file.appendText(
                            this.ServerInfo.logFile,
                            "ComfyUI process exited before task result, task aborted\n",
                            { isDataPath: true },
                        );
                        throw t("error.comfyuiServiceExited");
                    }
                    await new Promise((r) => setTimeout(r, 1000));
                }
                if (!launcherResult.endTime) {
                    throw t("error.comfyuiTaskNoResult");
                }
                resultData.end = Date.now();
                resultData.data = await resultDataCalculator(
                    data,
                    launcherResult,
                );
                return { code: 0, msg: "ok", data: resultData };
            } catch (e) {
                return { code: -1, msg: e + "" };
            } finally {
                isRunning = false;
            }
        },
        // 文生图：通过 param.comfyuiName 选择工作流（prompt 由平台端独立传入）
        textToImage: async function (data: any) {
            return this._callFunc(
                data,
                async (data: any) => {
                    const param = data.param || {};
                    return {
                        id: data.id,
                        mode: "local",
                        modelConfig: {
                            type: "comfyuiWorkflow",
                            comfyuiName:
                                param.comfyuiName || "textToImageSd15Demo",
                            param: Object.assign(
                                { prompt: data.prompt },
                                param,
                            ),
                        },
                    };
                },
                this._resultUrlCalculator,
            );
        },

        // 图生图：通过 param.comfyuiName 选择工作流（prompt + image 由平台端独立传入）
        imageToImage: async function (data: any) {
            return this._callFunc(
                data,
                async (data: any) => {
                    const param = data.param || {};
                    return {
                        id: data.id,
                        mode: "local",
                        modelConfig: {
                            type: "comfyuiWorkflow",
                            comfyuiName:
                                param.comfyuiName || "imageToImageSd15Demo",
                            images: data.image ? [data.image] : [],
                            param: Object.assign(
                                { prompt: data.prompt },
                                param,
                            ),
                        },
                    };
                },
                this._resultUrlCalculator,
            );
        },

        // 文生视频：通过 param.comfyuiName 选择工作流（prompt 由平台端独立传入）
        textToVideo: async function (data: any) {
            return this._callFunc(
                data,
                async (data: any) => {
                    const param = data.param || {};
                    return {
                        id: data.id,
                        mode: "local",
                        modelConfig: {
                            type: "comfyuiWorkflow",
                            comfyuiName: param.comfyuiName || "minimaxH3",
                            param: Object.assign(
                                { prompt: data.prompt },
                                param,
                            ),
                        },
                    };
                },
                this._resultUrlCalculator,
            );
        },

        // 图生视频：通过 param.comfyuiName 选择工作流（prompt + images 由平台端独立传入）
        imageToVideo: async function (data: any) {
            return this._callFunc(
                data,
                async (data: any) => {
                    const param = data.param || {};
                    return {
                        id: data.id,
                        mode: "local",
                        modelConfig: {
                            type: "comfyuiWorkflow",
                            comfyuiName:
                                param.comfyuiName || "imageToVideoMiniMaxDemo",
                            images: data.images || [],
                            param: Object.assign(
                                { prompt: data.prompt },
                                param,
                            ),
                        },
                    };
                },
                this._resultUrlCalculator,
            );
        },

        // 数字人（视频对口型）：通过 param.comfyuiName 选择工作流（视频/音频由平台端传入）
        videoGen: async function (data: any) {
            return this._callFunc(
                data,
                async (data: any) => {
                    const param = data.param || {};
                    const modelConfig: any = {
                        type: "comfyuiWorkflow",
                        comfyuiName: param.comfyuiName || "latentsync",
                        param: Object.assign({}, param),
                    };
                    if (data.video) {
                        modelConfig.param.videoPath = data.video;
                    }
                    if (data.audio) {
                        modelConfig.param.audioPath = data.audio;
                    }
                    return {
                        id: data.id,
                        mode: "local",
                        modelConfig,
                    };
                },
                this._resultUrlCalculator,
            );
        },

        // 语音识别：通过 param.comfyuiName 选择工作流（audio 由平台端传入）
        asr: async function (data: any) {
            return this._callFunc(
                data,
                async (data: any) => {
                    const param = data.param || {};
                    if (!param.comfyuiName) {
                        throw t("error.comfyuiNoAsrWorkflow");
                    }
                    const modelConfig: any = {
                        type: "comfyuiWorkflow",
                        comfyuiName: param.comfyuiName,
                        param: Object.assign({}, param),
                    };
                    if (data.audio) {
                        modelConfig.param.audioPath = data.audio;
                    }
                    return {
                        id: data.id,
                        mode: "local",
                        modelConfig,
                    };
                },
                async (data: any, launcherResult: any) => {
                    if (!("records" in launcherResult.result)) {
                        if (launcherResult.result.error) {
                            throw launcherResult.result.error;
                        }
                        if (launcherResult.result.msg) {
                            throw launcherResult.result.msg;
                        }
                        throw t("error.runFailedCheckLog");
                    }
                    return { records: launcherResult.result.records || [] };
                },
            );
        },

        // 声音合成：通过 param.comfyuiName 选择工作流（text 由平台端独立传入）
        soundTts: async function (data: any) {
            return this._callFunc(
                data,
                async (data: any) => {
                    const param = data.param || {};
                    if (!param.comfyuiName) {
                        throw t("error.comfyuiNoSoundTtsWorkflow");
                    }
                    return {
                        id: data.id,
                        mode: "local",
                        modelConfig: {
                            type: "comfyuiWorkflow",
                            comfyuiName: param.comfyuiName,
                            param: Object.assign({ text: data.text }, param),
                        },
                    };
                },
                this._resultUrlCalculator,
            );
        },

        // 声音复刻：通过 param.comfyuiName 选择工作流（text + promptAudio 由平台端传入）
        soundClone: async function (data: any) {
            return this._callFunc(
                data,
                async (data: any) => {
                    const param = data.param || {};
                    if (!param.comfyuiName) {
                        throw t("error.comfyuiNoSoundCloneWorkflow");
                    }
                    return {
                        id: data.id,
                        mode: "local",
                        modelConfig: {
                            type: "comfyuiWorkflow",
                            comfyuiName: param.comfyuiName,
                            param: Object.assign({ text: data.text }, param),
                        },
                    };
                },
                this._resultUrlCalculator,
            );
        },

        // 通用工作流（工具"通用ComfyUI"）：选择 biz 未识别的任意工作流，
        // 按该工作流 meta.json 的 param 定义渲染表单后调用。
        // 结果返回 {url, files}，前端按输出类型展示（file 单文件 / files 多文件 / text 文本）。
        general: async function (data: any) {
            return this._callFunc(
                data,
                async (data: any) => {
                    const param = data.param || {};
                    if (!param.comfyuiName) {
                        throw t("error.comfyuiWorkflowRequired");
                    }
                    return {
                        id: data.id,
                        mode: "local",
                        modelConfig: {
                            type: "comfyuiWorkflow",
                            comfyuiName: param.comfyuiName,
                            // 输入统一由 param 普通对象承载（image/video 等文件路径
                            // 作为字段值），模型端自动识别上传，无需特殊输入字段
                            param,
                        },
                    };
                },
                async (data: any, launcherResult: any) => {
                    const r = launcherResult.result;
                    if (!("url" in r) && !("files" in r)) {
                        if (r.error) {
                            throw r.error;
                        }
                        if (r.msg) {
                            throw r.msg;
                        }
                        throw t("error.runFailedCheckLog");
                    }
                    // 返回全部输出文件（url 主文件 + files 列表），前端按类型展示
                    return {
                        url: r.url || null,
                        files: r.files || (r.url ? [r.url] : []),
                    };
                },
            );
        },
    };
};
