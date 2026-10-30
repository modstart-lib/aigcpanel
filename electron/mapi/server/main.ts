import ServerApi from "./api";
import { ipcMain } from "electron";
import { Log } from "../log/main";
import { mapError } from "./error";
import { AigcServer } from "../../aigcserver";
import { voiceApiTest, maskVoiceApiConfig } from "../../aigcserver/VoiceApi";
import { SendType, ServerContext, ServerInfo } from "./type";
import { Files } from "../file/main";
import { getGpuInfo } from "../../lib/env-main";
import { EnumServerType } from "../../../src/types/Server";

ipcMain.handle("server:listGpus", async (event) => {
    return await getGpuInfo();
});

let runningServerCount = 0;
ipcMain.handle(
    "server:runningServerCount",
    async (event, count: number | null) => {
        if (count === null) {
            return runningServerCount;
        }
        // console.log('runningServerCount', count)
        runningServerCount = count;
        return runningServerCount;
    },
);
const getRunningServerCount = () => {
    return runningServerCount;
};

const serverModule: {
    [key: string]: ServerContext;
} = {};

const init = () => {};

const getModule = async (
    serverInfo: ServerInfo,
    option?: {
        throwException: boolean;
    },
): Promise<ServerContext> => {
    option = Object.assign(
        {
            throwException: true,
        },
        option,
    );
    // console.log('getModule', serverInfo)
    if (!serverModule[serverInfo.localPath]) {
        try {
            if (serverInfo.name.startsWith("Cloud")) {
                const server = new AigcServer["Cloud"]();
                server.type = "buildIn";
                server.ServerApi = ServerApi;
                await server.init();
                serverModule[serverInfo.localPath] = server;
            } else if (serverInfo.name in AigcServer) {
                const server = AigcServer[serverInfo.name] as ServerContext;
                server.type = "buildIn";
                server.ServerApi = ServerApi;
                await server.init();
                serverModule[serverInfo.localPath] = server;
            } else if (serverInfo.type === EnumServerType.REMOTE) {
                const server = new AigcServer["RemoteServer"](serverInfo);
                server.type = "buildIn";
                server.ServerApi = ServerApi;
                await server.init();
                serverModule[serverInfo.localPath] = server;
            } else if (serverInfo.type === EnumServerType.API) {
                const server = new AigcServer["ApiServer"](serverInfo);
                server.type = "buildIn";
                server.ServerApi = ServerApi;
                await server.init();
                serverModule[serverInfo.localPath] = server;
            } else {
                const serverPath = `${serverInfo.localPath}/server.js`;
                const configPath = `${serverInfo.localPath}/config.json`;

                let server = null;
                if (
                    await Files.exists(serverPath, {
                        isDataPath: false,
                    })
                ) {
                    const module = await import(`file://${serverPath}`);
                    server = module.default;
                }
                if (
                    !server &&
                    (await Files.exists(configPath, {
                        isDataPath: false,
                    }))
                ) {
                    const configContent = await Files.read(configPath, {
                        isDataPath: false,
                    });
                    try {
                        const config = JSON.parse(configContent);
                        if (config.type === "comfyui") {
                            // ComfyUI 类型：每实例独立创建（避免多实例共享状态污染：
                            // port 残留导致 ping 误判、任务结果串号等）
                            // 注意：不能 server.config = config（会覆盖 config 方法）
                            server = AigcServer["ComfyUI"](
                                config,
                            ) as ServerContext;
                            server.type = "custom";
                        } else if (config.entry === "__EasyServer__") {
                            server = new AigcServer["EasyServer"](config);
                        } else {
                            throw `ServerEntryNotFound : ${config.entry}`;
                        }
                    } catch (e) {
                        throw `ConfigParseError : ${configPath}`;
                    }
                }
                if (!server) {
                    throw `ServerFileNotFound : ${serverPath}`;
                }
                server.type = "custom";
                server.ServerApi = ServerApi;
                if (server.init) {
                    await server.init();
                }
                server.send = (type: SendType, data: any) => {
                    server.ServerApi.event.sendChannel(
                        server.ServerInfo.eventChannelName,
                        { type, data },
                    );
                };
                server.sendLog = (data: any) => {
                    server.ServerApi.file.appendText(
                        server.ServerInfo.logFile,
                        data,
                        { isDataPath: true },
                    );
                };
                serverModule[serverInfo.localPath] = server;
            }
        } catch (e) {
            if (!option.throwException) {
                return null;
            }
            const error = mapError(e);
            Log.error("mapi.server.getModule.error", error);
            throw error;
        }
    }
    // console.log('getModule', serverInfo, serverModule[serverInfo.localPath])
    // 保留上一次的事件通道/日志文件：状态查询等调用传入的 ServerInfo 可能不含
    // eventChannelName，直接覆盖会导致进行中的 prepare 进度事件丢失
    const module = serverModule[serverInfo.localPath];
    const previous = module.ServerInfo;
    module.ServerInfo = {
        ...serverInfo,
        eventChannelName:
            serverInfo.eventChannelName || previous?.eventChannelName || "",
        logFile: serverInfo.logFile || previous?.logFile || "",
    };
    return module;
};

ipcMain.handle("server:isSupport", async (event, serverInfo: ServerInfo) => {
    try {
        const module = await getModule(serverInfo, {
            throwException: false,
        });
        return !!module;
    } catch (e) {
        return false;
    }
});

ipcMain.handle("server:start", async (event, serverInfo: ServerInfo) => {
    const module = await getModule(serverInfo);
    try {
        return await module.start();
    } catch (e) {
        const error = mapError(e);
        Log.error("mapi.server.start.error", error);
        throw error;
    }
});

// 权重按需下载（prepare）：未就绪时先完成下载，进度通过 eventChannel 的
// "preparing" 事件推送；对未配置 prepare 的服务等同于无操作。
ipcMain.handle("server:prepare", async (event, serverInfo: ServerInfo) => {
    const module = await getModule(serverInfo);
    try {
        if (typeof module.prepare !== "function") {
            return { required: false, ready: true, percent: 100 };
        }
        await module.prepare();
        return await module.prepareStatus();
    } catch (e) {
        const error = mapError(e);
        Log.error("mapi.server.prepare.error", error);
        throw error;
    }
});

ipcMain.handle(
    "server:prepareStatus",
    async (event, serverInfo: ServerInfo) => {
        const module = await getModule(serverInfo, {
            throwException: false,
        });
        if (!module || typeof module.prepareStatus !== "function") {
            return { required: false, ready: true, percent: 100 };
        }
        try {
            return await module.prepareStatus();
        } catch (e) {
            Log.error("mapi.server.prepareStatus.error", mapError(e));
            return { required: true, ready: false, percent: 0 };
        }
    },
);

// 暂停权重下载（保留已下载文件与 .part，并写暂停标记；稍后「继续下载」可续传）
ipcMain.handle("server:pausePrepare", async (event, serverInfo: ServerInfo) => {
    const module = await getModule(serverInfo, {
        throwException: false,
    });
    if (!module || typeof module.pausePrepare !== "function") {
        return false;
    }
    return await module.pausePrepare();
});

ipcMain.handle("server:ping", async (event, serverInfo: ServerInfo) => {
    const module = await getModule(serverInfo);
    try {
        return await module.ping();
    } catch (e) {
        const error = mapError(e);
        Log.error("mapi.server.ping.error", error);
        throw error;
    }
    return false;
});

ipcMain.handle("server:stop", async (event, serverInfo: ServerInfo) => {
    const module = await getModule(serverInfo);
    try {
        return await module.stop();
    } catch (e) {
        const error = mapError(e);
        Log.error("mapi.server.stop.error", error);
        throw error;
    }
});

ipcMain.handle("server:cancel", async (event, serverInfo: ServerInfo) => {
    const module = await getModule(serverInfo);
    try {
        return await module.cancel();
    } catch (e) {
        const error = mapError(e);
        Log.error("mapi.server.cancel.error", error);
        throw error;
    }
});

// 离线授权：写入 auth.json 并让对应服务继续启动/重试
ipcMain.handle(
    "server:submitOfflineAuth",
    async (event, serverInfo: ServerInfo, token: string) => {
        const module = await getModule(serverInfo);
        if (typeof module.submitOfflineAuth !== "function") {
            return { code: -1, msg: "OfflineAuthNotSupported" };
        }
        try {
            return await module.submitOfflineAuth(token);
        } catch (e) {
            const error = mapError(e);
            Log.error("mapi.server.submitOfflineAuth.error", error);
            return { code: -1, msg: error };
        }
    },
);

// 模型卡片展示授权到期时间：只读 auth.json（不启动 launcher）
ipcMain.handle(
    "server:offlineAuthToken",
    async (event, serverInfo: ServerInfo) => {
        try {
            const content = await Files.read(
                serverInfo.localPath + "/auth.json",
            );
            const data = content ? JSON.parse(content) : {};
            return { code: 0, data: { token: (data && data.token) || "" } };
        } catch (e) {
            return { code: 0, data: { token: "" } };
        }
    },
);

// 「AI模型」管理：读取当前 auth.json（查看/修改离线授权）
ipcMain.handle(
    "server:offlineAuthInfo",
    async (event, serverInfo: ServerInfo) => {
        let token = "";
        try {
            const content = await Files.read(
                serverInfo.localPath + "/auth.json",
            );
            const data = content ? JSON.parse(content) : {};
            token = (data && data.token) || "";
        } catch (e) {
            token = "";
        }
        // 设备码由模型内的 launcher `uuid` 输出（与授权失败标记里的 machineId 一致）
        let machineId = "";
        try {
            const module: any = await getModule(serverInfo);
            if (module && typeof module.offlineAuthMachineId === "function") {
                machineId = (await module.offlineAuthMachineId()) || "";
            }
        } catch (e) {
            machineId = "";
        }
        return { code: 0, data: { token, machineId } };
    },
);

// 「AI模型」管理：直接保存授权码（不依赖挂起的任务，重启模型后生效）
ipcMain.handle(
    "server:saveOfflineAuth",
    async (event, serverInfo: ServerInfo, token: string) => {
        try {
            const value = String(token || "").trim();
            if (!value) {
                return { code: -1, msg: "OfflineAuthInvalidToken" };
            }
            // 必须调用 launcher 二进制真实校验（签名/包名/设备码/有效期）后再保存
            const module: any = await getModule(serverInfo);
            if (!module || typeof module.offlineAuthSave !== "function") {
                return { code: -1, msg: "OfflineAuthNotSupported" };
            }
            return await module.offlineAuthSave(value);
        } catch (e) {
            return { code: -1, msg: mapError(e) };
        }
    },
);

// 「AI模型」管理：撤销离线授权（删除 auth.json，重启模型后生效）
ipcMain.handle(
    "server:revokeOfflineAuth",
    async (event, serverInfo: ServerInfo) => {
        try {
            await Files.deletes(serverInfo.localPath + "/auth.json", {
                isDataPath: false,
            });
            return { code: 0, msg: "ok" };
        } catch (e) {
            return { code: -1, msg: mapError(e) };
        }
    },
);

ipcMain.handle(
    "server:cancelOfflineAuth",
    async (event, serverInfo: ServerInfo) => {
        const module = await getModule(serverInfo);
        if (typeof module.cancelOfflineAuth !== "function") {
            return { code: -1, msg: "OfflineAuthNotSupported" };
        }
        try {
            return await module.cancelOfflineAuth();
        } catch (e) {
            const error = mapError(e);
            Log.error("mapi.server.cancelOfflineAuth.error", error);
            return { code: -1, msg: error };
        }
    },
);

ipcMain.handle("server:deletes", async (event, serverInfo: ServerInfo) => {
    if (serverModule[serverInfo.localPath]) {
        delete serverModule[serverInfo.localPath];
    }
    return true;
});

ipcMain.handle(
    "server:apiVoiceTest",
    async (event, config: any, text: string) => {
        // 试听校验发生在模型落库之前，没有 server 记录也没有本地模型日志，
        // 必须在主进程日志里留下厂商请求/响应信息，否则用户上报时无从排查。
        try {
            const url = await voiceApiTest(
                config,
                text || "你好，这是一段语音试听。",
            );
            return { code: 0, msg: "ok", data: { url } };
        } catch (e: any) {
            const msg = (e && e.message) || String(e);
            Log.error("mapi.server.apiVoiceTest.error", {
                config: maskVoiceApiConfig(config),
                text,
                error: msg,
            });
            return { code: -1, msg };
        }
    },
);

ipcMain.handle("server:config", async (event, serverInfo: ServerInfo) => {
    const module = await getModule(serverInfo);
    try {
        return await module.config();
    } catch (e) {
        const error = mapError(e);
        Log.error("mapi.server.config.error", error);
        throw error;
    }
});

ipcMain.handle(
    "server:callFunction",
    async (
        event,
        serverInfo: ServerInfo,
        method: string,
        data: any,
        option: any,
    ) => {
        // console.log('getModule.before', serverInfo, method)
        const module = await getModule(serverInfo);
        // console.log('getModule.end', serverInfo, method, module)
        const func = module[method];
        if (!func) {
            throw new Error(`MethodNotFound : ${method}`);
        }
        try {
            return await func.bind(module)(data, option || {});
        } catch (e) {
            const error = mapError(e);
            Log.error("mapi.server.callFunction.error", {
                type: typeof e,
                error,
                serverInfo,
                method,
                data,
                option,
            });
            return {
                code: -1,
                msg: error,
            };
        }
    },
);

export default {
    init,
};

export const ServerMain = {
    getRunningServerCount,
    getModule,
    // 权重按需下载：确保权重就绪（未配置 prepare 的服务直接返回）
    prepare: async (serverInfo: ServerInfo) => {
        const module = await getModule(serverInfo, {
            throwException: false,
        });
        if (!module || typeof module.prepare !== "function") {
            return { required: false, ready: true, percent: 100 };
        }
        await module.prepare();
        return await module.prepareStatus();
    },
    pausePrepare: async (serverInfo: ServerInfo) => {
        const module = await getModule(serverInfo, {
            throwException: false,
        });
        if (!module || typeof module.pausePrepare !== "function") {
            return false;
        }
        return await module.pausePrepare();
    },
    prepareStatus: async (serverInfo: ServerInfo) => {
        const module = await getModule(serverInfo, {
            throwException: false,
        });
        if (!module || typeof module.prepareStatus !== "function") {
            return { required: false, ready: true, percent: 100 };
        }
        return await module.prepareStatus();
    },
    // 停止运行中的服务并清理模块缓存（HTTP 路由删除模型时使用，
    // 避免删除记录后服务进程残留）
    stopServer: async (serverInfo: ServerInfo) => {
        const module = await getModule(serverInfo, {
            throwException: false,
        });
        if (module && module.stop) {
            await module.stop();
        }
        if (serverModule[serverInfo.localPath]) {
            delete serverModule[serverInfo.localPath];
        }
    },
    callFunction: async (
        serverInfo: ServerInfo,
        method: string,
        data: any,
        option?: any,
    ) => {
        const module = await getModule(serverInfo);
        const func = module[method];
        if (!func) {
            throw new Error(`MethodNotFound: ${method}`);
        }
        return await func.bind(module)(data, option || {});
    },
};
