import { net } from "electron";
import { Client, handle_file } from "@gradio/client";
import { platformArch, platformName, platformUUID } from "../../lib/env";
import { Events } from "../event/main";
import { Apps } from "../app";
import { Files } from "../file/main";
import fs from "node:fs";
import User, { UserApi } from "../user/main";
import { EncodeUtil, MemoryMapCacheUtil } from "../../lib/util";
import { ServerContext, ServerFunctionDataType } from "./type";
import { UploadUtil } from "../../lib/upload";
import { Log } from "../log/main";

type RequestOptionType = {
    method?: "POST" | "GET";
    timeout?: number;
    headers?: Record<string, string>;
    responseType?: "json" | "text";
    retry?: number;
    retryTimes?: number;
    retryInterval?: number;
};

const request = async (url, data?: {}, option?: RequestOptionType) => {
    option = Object.assign(
        {
            method: "GET",
            timeout: 60 * 1000,
            headers: {
                "Content-Type": "application/json",
            },
            responseType: "json" as "json",
            retry: 0,
            retryTimes: 0,
            retryInterval: 5,
        },
        option,
    );
    if (option["method"] === "GET") {
        url += "?";
        for (let key in data) {
            url += `${key}=${data[key]}&`;
        }
    }
    return new Promise((resolve, reject) => {
        const req = net.request({
            url,
            method: option["method"],
            headers: option["headers"],
        });
        req.on("response", (response) => {
            let body = "";
            response.on("data", (chunk) => {
                body += chunk.toString();
            });
            response.on("end", () => {
                if ("json" === option["responseType"]) {
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        if (
                            option.retry > 0 &&
                            option.retryTimes < option.retry
                        ) {
                            option.retryTimes++;
                            Log.info(
                                "request",
                                `retry ${option.retryTimes} ${url}`,
                            );
                            setTimeout(() => {
                                request(url, data, option)
                                    .then(resolve)
                                    .catch(reject);
                            }, option.retryInterval * 1000);
                        } else {
                            resolve({
                                code: -1,
                                msg: `ResponseError: ${body}`,
                            });
                        }
                    }
                } else {
                    resolve(body);
                }
            });
        });
        req.on("error", (err) => {
            if (option.retry > 0 && option.retryTimes < option.retry) {
                option.retryTimes++;
                Log.info("request", `retry ${option.retryTimes} ${url}`);
                setTimeout(() => {
                    request(url, data, option).then(resolve).catch(reject);
                }, option.retryInterval * 1000);
            } else {
                reject(err);
            }
        });
        if (option["method"] === "POST") {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
};

const requestPost = async (url, data?: {}, option?: RequestOptionType) => {
    option = Object.assign(
        {
            method: "POST",
        },
        option,
    );
    return request(url, data, option);
};

const requestGet = async (url, data?: {}, option?: RequestOptionType) => {
    option = Object.assign(
        {
            method: "GET",
        },
        option,
    );
    return request(url, data, option);
};

const requestPostSuccess = async (
    url,
    data?: {},
    option?: RequestOptionType,
) => {
    const res = await requestPost(url, data, option);
    if (res["code"] === 0) {
        return res;
    }
    throw new Error(res["msg"]);
};

const requestUrlFileToLocal = async (url, path) => {
    return new Promise((resolve, reject) => {
        const req = net.request(url);
        req.on("response", (response) => {
            const file = fs.createWriteStream(path);
            // @ts-ignore
            response.pipe(file);
            file.on("finish", () => {
                file.close();
                resolve("x");
            });
        });
        req.on("error", (err) => {
            reject(err);
        });
        req.end();
    });
};

const requestEventSource = async (
    url: string,
    param: any,
    option?: {
        method?: "POST" | "GET";
        headers?: Record<string, string>;
        onMessage: (data: any) => void;
        onEnd?: () => void;
    },
) => {
    option = Object.assign(
        {
            method: "POST",
            headers: {},
            onMessage: (data: any) => {
                console.log("onMessage", data);
            },
            onEnd: () => {
                console.log("onEnd");
            },
        },
        option,
    );
    // return new Promise((resolve, reject) => {
    //     const req = net.request({
    //         url,
    //         method: option.method,
    //         headers: {
    //             'Content-Type': 'application/json',
    //             ...option.headers,
    //         },
    //     })
    //     req.on('response', (response) => {
    //         console.log('response', response)
    //         let buffer = ''
    //         response.on('data', (chunk) => {
    //             console.log('response.data', chunk)
    //             buffer += chunk.toString()
    //             const lines = buffer.split("\n")
    //             buffer = lines.pop()
    //             for (const line of lines) {
    //                 if (line.startsWith("data: ")) {
    //                     const data = line.slice(6)
    //                     if ('[END]' === data) {
    //                         option.onEnd()
    //                         return;
    //                     }
    //                     const eventData = line.slice(6).trim();
    //                     option.onMessage(EncodeUtil.base64Decode(eventData))
    //                 }
    //             }
    //         })
    //         response.on('end', () => {
    //             resolve(undefined)
    //         })
    //     })
    //     req.on('error', (err) => {
    //         reject(err)
    //     })
    //     req.end()
    // });
    const response = await net.fetch(url, {
        method: option.method,
        headers: {
            "Content-Type": "application/json",
            ...option.headers,
        },
        body: JSON.stringify(param || {}),
    });
    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        // console.log('fetchEventSource', JSON.stringify(buffer))
        for (const line of lines) {
            // console.log('line', JSON.stringify(line))
            if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if ("[END]" === data) {
                    option.onEnd();
                    return;
                }
                const eventData = line.slice(6).trim();
                option.onMessage(EncodeUtil.base64Decode(eventData));
            }
        }
    }
};

// 透传环境变量：外部调用方（如 CLI）通过请求 env 字段传入的 AIGCPANEL_* 变量，
// launcher 启动服务时合并到服务进程环境（如 AIGCPANEL_SKIP_LONG 测试开关）
let extraEnv: Record<string, string> = {};

const setExtraEnv = (env: Record<string, string>) => {
    if (!env || typeof env !== "object") {
        return;
    }
    // 仅保留 AIGCPANEL_ 前缀（安全：避免外部请求注入任意环境变量）
    const filtered: Record<string, string> = {};
    for (const k in env) {
        const v = env[k];
        if (k.startsWith("AIGCPANEL_") && v !== undefined && v !== null) {
            filtered[k] = String(v);
        }
    }
    extraEnv = filtered;
};

const env = async () => {
    const result = {};
    result["AIGCPANEL_SERVER_API_TOKEN"] = await User.getApiToken();
    result["AIGCPANEL_SERVER_UUID"] = platformUUID();
    // 合并透传的 AIGCPANEL_* 环境变量（不覆盖服务端固定变量）
    for (const k in extraEnv) {
        if (!(k in result)) {
            result[k] = extraEnv[k];
        }
    }
    return result;
};

const sleep = async (ms) => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};

const launcherCancel = async (context: ServerContext) => {
    const ret = (await requestPost(`${context.url()}cancel`, {})) as any;
    // console.log('cancel', JSON.stringify(ret))
    if (ret.code) {
        throw new Error(`cancel ${ret.msg}`);
    }
};

const launcherSubmitAndQuery = async (
    context: ServerContext,
    data: ServerFunctionDataType,
    option?: {
        timeout: number;
    },
): Promise<{
    result: {
        [key: string]: any;
    };
    endTime: number;
}> => {
    option = Object.assign(
        {
            timeout: 24 * 3600,
        },
        option,
    );
    const submitRet = (await requestPost(
        `${context.url()}submit`,
        data,
    )) as any;
    // console.log('submitRet', JSON.stringify(submitRet))
    if (submitRet.code) {
        throw new Error(`submit ${submitRet.msg}`);
    }
    const launcherResult = {
        result: {} as {
            [key: string]: any;
        },
        endTime: null,
    };
    const totalWait = Math.ceil(option.timeout / 5);
    for (let i = 0; i < totalWait; i++) {
        if (i >= totalWait - 1) {
            throw new Error("timeout");
        }
        await sleep(5000);
        const queryRet = (await requestPost(
            `${context.url()}query`,
            {
                token: submitRet.data.token,
            },
            {
                retry: 3,
            },
        )) as any;
        // console.log('queryRet', JSON.stringify(queryRet))
        if (queryRet.code) {
            throw new Error(queryRet.msg);
        }
        let logs = queryRet.data.logs;
        if (logs) {
            logs = EncodeUtil.base64Decode(logs);
            if (logs) {
                await Files.appendText(context.ServerInfo.logFile, logs);
                const result = extractResultFromLogs(data.id, logs);
                if (result) {
                    launcherResult.result = Object.assign(
                        launcherResult.result,
                        result,
                    );
                    context.send("taskResult", { id: data.id, result });
                }
            }
        }
        if (queryRet.data.status === "running") {
            continue;
        } else if (queryRet.data.status === "success") {
            launcherResult.endTime = Date.now();
            await Files.appendText(context.ServerInfo.logFile, "success");
        } else {
            let msg = "请在模型日志中查看错误日志";
            if (launcherResult.result && launcherResult.result.msg) {
                msg = launcherResult.result.msg;
            }
            throw `运行错误：${msg}`;
        }
        break;
    }
    return launcherResult;
};

const launcherPrepareConfigJson = async (data: any) => {
    const configJson = await Files.temp("json");
    await Files.write(configJson, JSON.stringify(data), { isDataPath: false });
    return configJson;
};

const launcherSubmitConfigJsonAndQuery = async (
    context: ServerContext,
    configData: any,
) => {
    if (!("setting" in configData)) {
        configData.setting = context.ServerInfo.setting;
    }
    const configJsonPath = await launcherPrepareConfigJson(configData);
    const result = await launcherSubmitAndQuery(context, {
        id: configData.id,
        result: {},
        entryPlaceholders: {
            CONFIG: configJsonPath,
        },
        root: context.ServerInfo.localPath,
    });
    await Files.deletes(configJsonPath, { isDataPath: false });
    return result;
};

const extractResultFromLogs = (dataId: string, logs: string) => {
    let result = null;
    logs.split("\n").forEach((line) => {
        // regex AigcPanelRunResult[VideoGen_121][xxxxx=]
        const match = line.match(
            new RegExp(`AigcPanelRunResult\\[${dataId}\\]\\[(.*?)\\]`),
        );
        // console.log('match', {_data, match})
        if (match) {
            const matchResult = JSON.parse(EncodeUtil.base64Decode(match[1]));
            result = Object.assign(result || {}, matchResult);
        }
    });
    return result;
};

// 离线授权标记：启动器授权失败时输出 AigcPanelOfflineAuth[<base64 JSON>]，
// 客户端据此弹出「请输入离线授权码」弹窗（见 aigcpanel-server-launcher
// server/common/offline_auth.go）。
const OFFLINE_AUTH_MARKER = "AigcPanelOfflineAuth[";

const extractOfflineAuthRequired = (logs: string) => {
    let result: {
        machineId?: string;
        packageName?: string;
        version?: string;
        reason?: string;
    } | null = null;
    logs.split("\n").forEach((line) => {
        const index = line.indexOf(OFFLINE_AUTH_MARKER);
        if (index === -1) {
            return;
        }
        const start = index + OFFLINE_AUTH_MARKER.length;
        const end = line.indexOf("]", start);
        if (end === -1) {
            return;
        }
        try {
            result = JSON.parse(
                EncodeUtil.base64Decode(line.substring(start, end)),
            );
        } catch (e) {
            // 标记行不完整（被 stdout 分片截断）时忽略，等待后续数据
        }
    });
    return result;
};

const availablePort = async (
    port: number,
    setting: {
        port?: number;
    },
) => {
    setting = setting || {};
    if (port) {
        return port;
    }
    if (setting["port"]) {
        port = parseInt(setting["port"] as any);
    } else if (!port || !(await Apps.isPortAvailable(port))) {
        port = await Apps.availablePort(50617);
    }
    return port;
};

const pathSep = () => {
    return process.platform === "win32" ? ";" : ":";
};

const getPathEnv = (addition: string | string[] = null) => {
    let p = process.env["PATH"] || "";
    if (addition) {
        const sep = pathSep();
        if (typeof addition === "string") {
            addition = [addition];
        }
        for (let path of addition) {
            if (p.indexOf(path) === -1) {
                p = `${path}${sep}${p}`;
            }
        }
    }
    return p;
};

export default {
    GradioClient: Client,
    GradioHandleFile: handle_file,
    event: Events,
    file: Files,
    app: Apps,
    request,
    requestPost,
    requestGet,
    requestPostSuccess,
    requestUrlFileToLocal,
    requestEventSource,
    platformName: platformName(),
    platformArch: platformArch(),
    env,
    setExtraEnv,
    sleep,
    base64Encode: EncodeUtil.base64Encode,
    base64Decode: EncodeUtil.base64Decode,
    launcherCancel,
    launcherSubmitAndQuery,
    launcherPrepareConfigJson,
    launcherSubmitConfigJsonAndQuery,
    extractResultFromLogs,
    extractOfflineAuthRequired,
    availablePort,
    getPathEnv,
};
