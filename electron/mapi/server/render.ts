import { ipcRenderer } from "electron";
import { ServerInfo } from "./type";

const listGpus = async () => {
    return ipcRenderer.invoke("server:listGpus");
};

const runningServerCount = async (count: number | null) => {
    return ipcRenderer.invoke("server:runningServerCount", count);
};

const isSupport = async (serverInfo: ServerInfo) => {
    return ipcRenderer.invoke("server:isSupport", serverInfo);
};

const start = async (serverInfo: ServerInfo) => {
    return ipcRenderer.invoke("server:start", serverInfo);
};

const prepare = async (serverInfo: ServerInfo) => {
    return ipcRenderer.invoke("server:prepare", serverInfo);
};

const prepareStatus = async (serverInfo: ServerInfo) => {
    return ipcRenderer.invoke("server:prepareStatus", serverInfo);
};

const pausePrepare = async (serverInfo: ServerInfo) => {
    return ipcRenderer.invoke("server:pausePrepare", serverInfo);
};

const ping = async (serverInfo: ServerInfo) => {
    return ipcRenderer.invoke("server:ping", serverInfo);
};

const stop = async (serverInfo: ServerInfo) => {
    return ipcRenderer.invoke("server:stop", serverInfo);
};

const cancel = async (serverInfo: ServerInfo) => {
    return ipcRenderer.invoke("server:cancel", serverInfo);
};

const submitOfflineAuth = async (serverInfo: ServerInfo, token: string) => {
    return ipcRenderer.invoke("server:submitOfflineAuth", serverInfo, token);
};

const cancelOfflineAuth = async (serverInfo: ServerInfo) => {
    return ipcRenderer.invoke("server:cancelOfflineAuth", serverInfo);
};

const offlineAuthToken = async (serverInfo: ServerInfo) => {
    return ipcRenderer.invoke("server:offlineAuthToken", serverInfo);
};

const offlineAuthInfo = async (serverInfo: ServerInfo) => {
    return ipcRenderer.invoke("server:offlineAuthInfo", serverInfo);
};

const saveOfflineAuth = async (serverInfo: ServerInfo, token: string) => {
    return ipcRenderer.invoke("server:saveOfflineAuth", serverInfo, token);
};

const revokeOfflineAuth = async (serverInfo: ServerInfo) => {
    return ipcRenderer.invoke("server:revokeOfflineAuth", serverInfo);
};

const deletes = async (serverInfo: ServerInfo) => {
    return ipcRenderer.invoke("server:deletes", serverInfo);
};

const config = async (serverInfo: ServerInfo) => {
    return ipcRenderer.invoke("server:config", serverInfo);
};

const apiVoiceTest = async (config: any, text: string) => {
    return ipcRenderer.invoke("server:apiVoiceTest", config, text);
};

const callFunction = async (
    serverInfo: ServerInfo,
    method: string,
    data: any,
    option: any,
) => {
    return ipcRenderer.invoke(
        "server:callFunction",
        serverInfo,
        method,
        data,
        option,
    );
};

const callFunctionWithException = async (
    serverInfo: ServerInfo,
    method: string,
    data: any,
    option: any,
) => {
    try {
        return await ipcRenderer.invoke(
            "server:callFunction",
            serverInfo,
            method,
            data,
            option,
        );
    } catch (e) {
        return {
            code: -1,
            msg: e + "",
        };
    }
};

export default {
    listGpus,
    runningServerCount,
    isSupport,
    start,
    prepare,
    prepareStatus,
    pausePrepare,
    ping,
    stop,
    cancel,
    submitOfflineAuth,
    cancelOfflineAuth,
    offlineAuthToken,
    offlineAuthInfo,
    saveOfflineAuth,
    revokeOfflineAuth,
    deletes,
    config,
    apiVoiceTest,
    callFunction,
    callFunctionWithException,
};
