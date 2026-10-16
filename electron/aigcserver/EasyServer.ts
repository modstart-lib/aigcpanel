import { Files } from "../mapi/file/main";
import { Log } from "../mapi/log/main";
import {
    SendType,
    ServerApiType,
    ServerFunctionDataType,
    ServerInfo,
} from "../mapi/server/type";
import { AigcServerUtil } from "./util";
import { t } from "../config/lang";

type LauncherResultType = {
    result: {
        [key: string]: any;
    };
    endTime: number | null;
};

export const EasyServer = function (config: any) {
    const me = this;
    let controller: any = null;
    let controllerWatching = {
        id: null as string | null,
        launcherResult: null as LauncherResultType | null,
        resolve: null as ((value: any) => void) | null,
        reject: null as ((reason?: any) => void) | null,
        promiseResolved: false,
    };
    this.serverConfig = config as {
        easyServer: {
            entry: string;
            entryArgs: string[];
            envs: string[];
            content: string;
            functions: {
                [key: string]: {
                    content?: string;
                    param?: any[];
                };
            };
        };
    };
    this.isRunning = false;
    this.ServerApi = null as ServerApiType | null;
    this.ServerInfo = null as ServerInfo | null;
    this.serverRuntime = {
        startTime: 0,
    };
    this.send = function (type: SendType, data: any) {
        this.ServerApi.event.sendChannel(this.ServerInfo.eventChannelName, {
            type,
            data,
        });
    };
    this.init = async function () {};
    this.config = async function () {
        // config.json 的 functions 有两种写法：
        // - 新写法：顶层 functions 直接是 { [func]: { param, result, content } } 映射
        // - 旧写法：顶层 functions 为能力名数组，函数定义放在 easyServer.functions
        // 优先使用顶层对象形式，兼容旧写法的 easyServer.functions。
        const easyServer = this.serverConfig.easyServer || {};
        const topFunctions = this.serverConfig.functions;
        const functions =
            topFunctions &&
            typeof topFunctions === "object" &&
            !Array.isArray(topFunctions)
                ? topFunctions
                : easyServer.functions || {};
        return {
            code: 0,
            msg: "ok",
            data: {
                httpUrl: null,
                content: easyServer.content || "",
                functions,
                // 通用模型定义（config.json 的 general 数组）：
                // 每项 { name, title, description, param, result }，供工具
                // "通用模型"渲染表单与展示结果（result 从 stdout 结果按 name 解析）
                general: this.serverConfig.general || [],
            },
        };
    };
    this.start = async function () {
        // console.log('start', this.ServerInfo)
        this.serverRuntime.startTime = Date.now();
        this.send("starting", this.ServerInfo);
    };
    this.ping = async function (): Promise<boolean> {
        // 只有存在正在运行的 launcher 进程才算服务在运行，
        // 不能仅凭 startTime（模型启动后进程可能已失败退出）
        return !!controller;
    };
    this.stop = async function () {
        // console.log('stop', this.ServerInfo)
        this.send("stopping", this.ServerInfo);
        this.serverRuntime.startTime = 0;
        this.send("stopped", this.ServerInfo);
        this.send("success", this.ServerInfo);
    };
    this.cancel = async function () {
        controller.stop();
    };
    this._controllerRunIfNeeded = async function (
        configJsonPath: string | null,
        option: {
            timeout: number;
        },
    ) {
        if (!controller) {
            let command = [];
            command.push(this.serverConfig.easyServer.entry);
            if (this.serverConfig.easyServer.entryArgs) {
                command = command.concat(
                    this.serverConfig.easyServer.entryArgs,
                );
            }
            for (let i = 0; i < command.length; i++) {
                command[i] = command[i].replace(
                    "${CONFIG}",
                    `"${configJsonPath}"`,
                );
                command[i] = command[i].replace(
                    "${ROOT}",
                    this.ServerInfo.localPath,
                );
            }
            const envMap = {};
            // console.log('EasyServer', this.serverConfig.easyServer)
            if (this.serverConfig.easyServer.entry === "launcher") {
                const systemEnv = await this.ServerApi.env();
                // console.log('EasyServer.systemEnv', systemEnv)
                for (const k in systemEnv) {
                    envMap[k] = systemEnv[k];
                }
            }
            envMap["PATH"] = this.ServerApi.getPathEnv([
                `${this.ServerInfo.localPath}`,
                `${this.ServerInfo.localPath}/binary`,
            ]);
            envMap["PYTHONIOENCODING"] = "utf-8";
            envMap["AIGCPANEL_SERVER_PLACEHOLDER_CONFIG"] = configJsonPath;
            envMap["AIGCPANEL_SERVER_PLACEHOLDER_ROOT"] =
                this.ServerInfo.localPath;
            if (this.serverConfig.easyServer.envs) {
                for (const e of this.serverConfig.easyServer.envs) {
                    let pcs = e.split("=");
                    const key = pcs.shift();
                    envMap[key] = pcs.join("=");
                }
            }
            for (const k in envMap) {
                envMap[k] = envMap[k].replace(
                    "${CONFIG}",
                    `"${configJsonPath}"`,
                );
                envMap[k] = envMap[k].replace(
                    "${ROOT}",
                    this.ServerInfo.localPath,
                );
            }
            // 取出 aigcpanel-queue 中遗留的排队任务并重新拉起执行。
            // 返回是否确实重新拉起了任务：进程退出时若存在排队任务，说明当前等待中
            // 的任务尚未真正执行（见下方 success / error 回调），需要继续等待，
            // 不能以空结果结束当前任务。
            const hasMoreQueue = async (): Promise<boolean> => {
                const queueRoot =
                    this.ServerInfo.localPath + `/aigcpanel-queue/`;
                const files = await Files.list(queueRoot);
                const validQueueFiles = files.filter((f) =>
                    f.name.match(/\.queue\.json$/),
                );
                if (validQueueFiles.length > 0) {
                    const configJson = await Files.temp("json");
                    await Files.copy(validQueueFiles[0].pathname, configJson);
                    await Files.deletes(validQueueFiles[0].pathname);
                    this._controllerRunIfNeeded(configJson, option);
                    return true;
                }
                return false;
            };
            let timer = null;
            if (option.timeout > 0) {
                timer = setTimeout(() => {
                    if (controller) {
                        try {
                            controller.stop();
                        } catch (e) {
                            Log.error("easyServer.timeout.stop.error", e);
                        }
                    }
                    this.ServerApi.file.appendText(
                        this.ServerInfo.logFile,
                        "timeout",
                        { isDataPath: true },
                    );
                    if (controllerWatching.reject) {
                        controllerWatching.reject(undefined);
                    }
                }, option.timeout * 1000);
            }
            let buffer = "";
            controller = await this.ServerApi.app.spawnShell(command, {
                env: envMap,
                cwd: this.ServerInfo.localPath,
                stdout: (_data) => {
                    // console.log('easyServer.stdout', _data)
                    buffer += _data;
                    // check if has \n and process the buffer
                    let lines = buffer.split("\n");
                    buffer = lines.pop() || "";
                    this.ServerApi.file.appendText(
                        this.ServerInfo.logFile,
                        _data,
                        { isDataPath: true },
                    );
                    const result = this.ServerApi.extractResultFromLogs(
                        controllerWatching.id,
                        lines.join("\n") + "\n",
                    );
                    if (result) {
                        if (controllerWatching.launcherResult) {
                            controllerWatching.launcherResult.result =
                                Object.assign(
                                    controllerWatching.launcherResult.result,
                                    result,
                                );
                        }
                        if (controllerWatching.id) {
                            this.send("taskResult", {
                                id: controllerWatching.id,
                                result,
                            });
                        }
                    }
                    if (controllerWatching.launcherResult) {
                        controllerWatching.launcherResult.result.error =
                            AigcServerUtil.errorDetect(_data) ||
                            controllerWatching.launcherResult.result.error;
                        if (
                            controllerWatching.launcherResult.result &&
                            controllerWatching.launcherResult.result["End"]
                        ) {
                            if (
                                controllerWatching.resolve &&
                                !controllerWatching.promiseResolved
                            ) {
                                controllerWatching.promiseResolved = true;
                                controllerWatching.resolve(undefined);
                            }
                        }
                    }
                },
                stderr: (_data) => {
                    // console.log('easyServer.stderr', _data)
                    this.ServerApi.file.appendText(
                        this.ServerInfo.logFile,
                        _data,
                        { isDataPath: true },
                    );
                    if (controllerWatching.launcherResult) {
                        controllerWatching.launcherResult.result.error =
                            AigcServerUtil.errorDetect(_data) ||
                            controllerWatching.launcherResult.result.error;
                    }
                },
                success: (_data) => {
                    // console.log('easyServer.success', _data)
                    clearTimeout(timer);
                    controller = null;
                    // 模型进程退出前若有任务被写入 aigcpanel-queue，说明当前等待中的
                    // 任务尚未真正执行（进程已进入退出窗口），需要重新拉起并继续等待
                    // 其结果；若此处直接以空结果 resolve，会误报「执行失败」，任务还会
                    // 被重新拉起执行，导致界面失败但实际已生成、且任务重复执行。
                    hasMoreQueue()
                        .then((redispatched) => {
                            if (redispatched) {
                                return;
                            }
                            if (
                                controllerWatching.resolve &&
                                !controllerWatching.promiseResolved
                            ) {
                                controllerWatching.promiseResolved = true;
                                controllerWatching.resolve(undefined);
                            }
                        })
                        .catch((e) => {
                            Log.error("easyServer.hasMoreQueue.error", e);
                            if (
                                controllerWatching.resolve &&
                                !controllerWatching.promiseResolved
                            ) {
                                controllerWatching.promiseResolved = true;
                                controllerWatching.resolve(undefined);
                            }
                        });
                },
                error: (_data, code) => {
                    // console.log('easyServer.error', {_data, controllerWatching})
                    this.ServerApi.file.appendText(
                        this.ServerInfo.logFile,
                        `exit code ${code}`,
                        { isDataPath: true },
                    );
                    clearTimeout(timer);
                    controller = null;
                    // 与 success 同理：进程异常退出时若队列中仍有任务，先重新拉起该
                    // 任务并继续等待其结果，避免把未执行的任务直接判为失败。
                    hasMoreQueue()
                        .then((redispatched) => {
                            if (redispatched) {
                                return;
                            }
                            if (
                                controllerWatching.reject &&
                                !controllerWatching.promiseResolved
                            ) {
                                controllerWatching.promiseResolved = true;
                                controllerWatching.reject(undefined);
                            }
                        })
                        .catch((e) => {
                            Log.error("easyServer.hasMoreQueue.error", e);
                            if (
                                controllerWatching.reject &&
                                !controllerWatching.promiseResolved
                            ) {
                                controllerWatching.promiseResolved = true;
                                controllerWatching.reject(undefined);
                            }
                        });
                },
            });
        } else if (configJsonPath) {
            const queueName = `${Date.now()}.queue.json`;
            const queuePath =
                this.ServerInfo.localPath + `/aigcpanel-queue/${queueName}`;
            await Files.copy(configJsonPath, queuePath);
            this.ServerApi.file.appendText(
                this.ServerInfo.logFile,
                `Another task is running, queued at ${queueName}`,
                { isDataPath: true },
            );
        }
    };
    this._callFunc = async function (
        data: ServerFunctionDataType,
        configCalculator: (data: ServerFunctionDataType) => Promise<any>,
        resultDataCalculator: (
            data: ServerFunctionDataType,
            launcherResult: LauncherResultType,
        ) => Promise<any>,
        option: {
            timeout: number;
        },
    ) {
        option = Object.assign(
            {
                timeout: 24 * 3600,
            },
            option,
        );
        const resultData = {
            // success, retry
            type: "success",
            start: 0,
            end: 0,
            data: {},
        };
        if (this.isRunning) {
            resultData.type = "retry";
            return {
                code: 0,
                msg: "ok",
                data: resultData,
            };
        }
        this.isRunning = true;
        resultData.start = Date.now();
        let configJsonPath = null;
        try {
            this.send("taskRunning", { id: data.id });
            const configData = await configCalculator(data);
            configData.setting = this.ServerInfo.setting;
            configJsonPath =
                await this.ServerApi.launcherPrepareConfigJson(configData);
            // console.log('EasyServer.envMap', envMap)
            const launcherResult: LauncherResultType = {
                result: {},
                endTime: null,
            };
            // console.log('easyServer.start', JSON.stringify({command, envMap, configData}))
            await (async () => {
                return new Promise((resolve, reject) => {
                    controllerWatching.id = data.id;
                    controllerWatching.launcherResult = launcherResult;
                    controllerWatching.resolve = resolve;
                    controllerWatching.reject = reject;
                    controllerWatching.promiseResolved = false;
                    me._controllerRunIfNeeded(configJsonPath, option);
                });
            })();
            resultData.end = Date.now();
            resultData.data = await resultDataCalculator(data, launcherResult);
            // console.log('easyServer.end', launcherResult)
            await Files.deletes(configJsonPath);
            return {
                code: 0,
                msg: "ok",
                data: resultData,
            };
        } catch (e) {
            throw e;
        } finally {
            this.isRunning = false;
        }
    };
    this.soundTts = async function (data: ServerFunctionDataType) {
        // console.log('soundTts', {data, serverInfo: this.ServerInfo})
        return this._callFunc(
            data,
            async (data: ServerFunctionDataType) => {
                return {
                    id: data.id,
                    mode: "local",
                    modelConfig: {
                        type: "soundTts",
                        param: data.param,
                        text: data.text,
                    },
                };
            },
            async (
                data: ServerFunctionDataType,
                launcherResult: LauncherResultType,
            ) => {
                if (!("url" in launcherResult.result)) {
                    if (launcherResult.result.error) {
                        throw launcherResult.result.error;
                    }
                    if (launcherResult.result.msg) {
                        throw launcherResult.result.msg;
                    }
                    throw t("error.runFailedCheckLog");
                }
                return {
                    url: launcherResult.result.url,
                };
            },
        );
    };
    this.soundClone = async function (data: ServerFunctionDataType) {
        // console.log('soundClone', {data, serverInfo: this.ServerInfo})
        return this._callFunc(
            data,
            async (data: ServerFunctionDataType) => {
                return {
                    id: data.id,
                    mode: "local",
                    modelConfig: {
                        type: "soundClone",
                        param: data.param,
                        text: data.text,
                        promptAudio: data.promptAudio,
                        promptText: data.promptText,
                    },
                };
            },
            async (
                data: ServerFunctionDataType,
                launcherResult: LauncherResultType,
            ) => {
                if (!("url" in launcherResult.result)) {
                    if (launcherResult.result.error) {
                        throw launcherResult.result.error;
                    }
                    if (launcherResult.result.msg) {
                        throw launcherResult.result.msg;
                    }
                    throw t("error.runFailedCheckLog");
                }
                return {
                    url: launcherResult.result.url,
                };
            },
        );
    };
    this.videoGen = async function (data: ServerFunctionDataType) {
        // console.log('videoGen', JSON.stringify({data, serverInfo: this.ServerInfo}))
        return this._callFunc(
            data,
            async (data: ServerFunctionDataType) => {
                return {
                    id: data.id,
                    mode: "local",
                    modelConfig: {
                        type: "videoGen",
                        param: data.param,
                        video: data.video,
                        audio: data.audio,
                    },
                };
            },
            async (
                data: ServerFunctionDataType,
                launcherResult: LauncherResultType,
            ) => {
                if (!("url" in launcherResult.result)) {
                    if (launcherResult.result.error) {
                        throw launcherResult.result.error;
                    }
                    if (launcherResult.result.msg) {
                        throw launcherResult.result.msg;
                    }
                    throw t("error.runFailedCheckLog");
                }
                return {
                    url: launcherResult.result.url,
                };
            },
        );
    };
    this.asr = async function (data: ServerFunctionDataType) {
        // console.log('videoGen', JSON.stringify({data, serverInfo: this.ServerInfo}))
        return this._callFunc(
            data,
            async (data: ServerFunctionDataType) => {
                return {
                    id: data.id,
                    mode: "local",
                    modelConfig: {
                        type: "asr",
                        audio: data.audio,
                        param: data.param,
                    },
                };
            },
            async (
                data: ServerFunctionDataType,
                launcherResult: LauncherResultType,
            ) => {
                if (!("records" in launcherResult.result)) {
                    if (launcherResult.result.error) {
                        throw launcherResult.result.error;
                    }
                    if (launcherResult.result.msg) {
                        throw launcherResult.result.msg;
                    }
                    throw t("error.runFailedCheckLog");
                }
                return {
                    records: launcherResult.result.records,
                };
            },
        );
    };
    this.textToImage = async function (data: ServerFunctionDataType) {
        // console.log('textToImage', {data, serverInfo: this.ServerInfo})
        return this._callFunc(
            data,
            async (data: ServerFunctionDataType) => {
                return {
                    id: data.id,
                    mode: "local",
                    modelConfig: {
                        type: "textToImage",
                        prompt: data.prompt,
                        param: data.param,
                    },
                };
            },
            async (
                data: ServerFunctionDataType,
                launcherResult: LauncherResultType,
            ) => {
                if (!("url" in launcherResult.result)) {
                    if (launcherResult.result.error) {
                        throw launcherResult.result.error;
                    }
                    if (launcherResult.result.msg) {
                        throw launcherResult.result.msg;
                    }
                    throw t("error.runFailedCheckLog");
                }
                return {
                    url: launcherResult.result.url,
                };
            },
        );
    };
    this.imageToImage = async function (data: ServerFunctionDataType) {
        // console.log('imageToImage', {data, serverInfo: this.ServerInfo})
        return this._callFunc(
            data,
            async (data: ServerFunctionDataType) => {
                return {
                    id: data.id,
                    mode: "local",
                    modelConfig: {
                        type: "imageToImage",
                        image: data.image,
                        prompt: data.prompt,
                        param: data.param,
                    },
                };
            },
            async (
                data: ServerFunctionDataType,
                launcherResult: LauncherResultType,
            ) => {
                if (!("url" in launcherResult.result)) {
                    if (launcherResult.result.error) {
                        throw launcherResult.result.error;
                    }
                    if (launcherResult.result.msg) {
                        throw launcherResult.result.msg;
                    }
                    throw t("error.runFailedCheckLog");
                }
                return {
                    url: launcherResult.result.url,
                };
            },
        );
    };
    this.textToVideo = async function (data: ServerFunctionDataType) {
        return this._callFunc(
            data,
            async (data: ServerFunctionDataType) => {
                return {
                    id: data.id,
                    mode: "local",
                    modelConfig: {
                        type: "textToVideo",
                        prompt: data.prompt,
                        param: data.param,
                    },
                };
            },
            async (
                data: ServerFunctionDataType,
                launcherResult: LauncherResultType,
            ) => {
                if (!("url" in launcherResult.result)) {
                    if (launcherResult.result.error) {
                        throw launcherResult.result.error;
                    }
                    if (launcherResult.result.msg) {
                        throw launcherResult.result.msg;
                    }
                    throw t("error.runFailedCheckLog");
                }
                return {
                    url: launcherResult.result.url,
                };
            },
        );
    };
    this.imageToVideo = async function (data: ServerFunctionDataType) {
        return this._callFunc(
            data,
            async (data: ServerFunctionDataType) => {
                return {
                    id: data.id,
                    mode: "local",
                    modelConfig: {
                        type: "imageToVideo",
                        images: data.images || [],
                        prompt: data.prompt,
                        param: data.param,
                    },
                };
            },
            async (
                data: ServerFunctionDataType,
                launcherResult: LauncherResultType,
            ) => {
                if (!("url" in launcherResult.result)) {
                    if (launcherResult.result.error) {
                        throw launcherResult.result.error;
                    }
                    if (launcherResult.result.msg) {
                        throw launcherResult.result.msg;
                    }
                    throw t("error.runFailedCheckLog");
                }
                return {
                    url: launcherResult.result.url,
                };
            },
        );
    };

    // 读取 config.json general[].result 声明的业务字段名列表，
    // 用于判断通用模型任务是否真正产出了结果。
    this._generalResultNames = function (funcName: string): string[] {
        const generalList = (me.serverConfig.general || []) as {
            name?: string;
            result?: { name?: string }[];
        }[];
        const def = generalList.find(
            (g) => g && g.name === (funcName || "general"),
        );
        if (!def || !Array.isArray(def.result)) {
            return [];
        }
        return def.result
            .map((r) => r && r.name)
            .filter((name): name is string => !!name);
    };

    // 通用模型调用（工具"通用模型"）：
    // 系统无法识别的模型在 config.json 声明 general 数组（param + result），
    // 平台按其 param 渲染表单提交，此处把参数透传给服务端；结果直接透传
    // stdout 返回的 json（字段名与 config.json general[].result 的 name 对应，
    // 前端按 result 定义解析展示，输出类型仅 file / files / text 三种）。
    this.general = async function (data: ServerFunctionDataType) {
        return this._callFunc(
            data,
            async (data: ServerFunctionDataType) => {
                return {
                    id: data.id,
                    mode: "local",
                    modelConfig: {
                        type: data.funcName || "general",
                        param: data.param,
                    },
                };
            },
            async (
                data: ServerFunctionDataType,
                launcherResult: LauncherResultType,
            ) => {
                const result = launcherResult.result || {};
                // 模型执行失败：优先抛出错误信息（如显存不足 / 崩溃侦测）
                if (result.error) {
                    throw result.error;
                }
                if (result.msg) {
                    throw result.msg;
                }
                // 校验任务是否真正产出了结果：
                // - config.json general[].result 声明了输出字段时，至少产出一个才算成功；
                // - 未声明输出字段时，退化为要求结束标记 End。
                // 否则说明模型进程异常退出（如启动即崩溃，launcher 本地模式仍以
                // 退出码 0 结束）或错误被吞掉只剩一个 End，不能当作成功。
                const resultNames = me._generalResultNames(
                    data.funcName || "general",
                );
                const succeeded =
                    resultNames.length > 0
                        ? resultNames.some((name) => name in result)
                        : !!result.End;
                if (!succeeded) {
                    throw t("error.runFailedCheckLog");
                }
                // 透传服务端结果 json（含 url/images/files/text/records 等字段）
                return result;
            },
        );
    };
};
