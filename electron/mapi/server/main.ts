import ServerApi from "./api";
import {ipcMain} from "electron";
import {Log} from "../log/main";
import {mapError} from "./error";
import {AigcServer} from "../../aigcserver";
import {SendType, ServerContext, ServerInfo} from "./type";
import {Files} from "../file/main";
import {getGpuInfo} from "../../lib/env-main";
import {EnumServerType} from "../../../src/types/Server";

ipcMain.handle("server:listGpus", async event => {
    return await getGpuInfo();
});

let runningServerCount = 0;
ipcMain.handle("server:runningServerCount", async (event, count: number | null) => {
    if (count === null) {
        return runningServerCount;
    }
    // console.log('runningServerCount', count)
    runningServerCount = count;
    return runningServerCount;
});
const getRunningServerCount = () => {
    return runningServerCount;
};

const serverModule: {
    [key: string]: ServerContext;
} = {};

const init = () => {
};

const getModule = async (
    serverInfo: ServerInfo,
    option?: {
        throwException: boolean;
    }
): Promise<ServerContext> => {
    option = Object.assign(
        {
            throwException: true,
        },
        option
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
                    const configContent = await Files.read(configPath, {isDataPath: false});
                    try {
                        const config = JSON.parse(configContent);
                        if (config.entry === "__EasyServer__") {
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
                    server.ServerApi.event.sendChannel(server.ServerInfo.eventChannelName, {type, data});
                };
                server.sendLog = (data: any) => {
                    server.ServerApi.file.appendText(server.ServerInfo.logFile, data, {isDataPath: true});
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
    serverModule[serverInfo.localPath].ServerInfo = serverInfo;
    return serverModule[serverInfo.localPath];
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

ipcMain.handle("server:deletes", async (event, serverInfo: ServerInfo) => {
    if (serverModule[serverInfo.localPath]) {
        delete serverModule[serverInfo.localPath];
    }
    return true;
});

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

ipcMain.handle("server:callFunction", async (event, serverInfo: ServerInfo, method: string, data: any, option: any) => {
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
});

export default {
    init,
};

export const ServerMain = {
    getRunningServerCount,
};
