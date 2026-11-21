import { ipcRenderer } from "electron";

const status = async (): Promise<{
    running: boolean;
    port: number;
    bindAddr: string;
    localAddr: string;
    lanEnabled: boolean;
    lanAddr: string;
}> => {
    return ipcRenderer.invoke("httpserver:status");
};

const start = async (): Promise<{ code: number; msg?: string }> => {
    return ipcRenderer.invoke("httpserver:start");
};

const stop = async (): Promise<{ code: number }> => {
    return ipcRenderer.invoke("httpserver:stop");
};

const restart = async (): Promise<{ code: number; msg?: string }> => {
    return ipcRenderer.invoke("httpserver:restart");
};

const getConfig = async (): Promise<{
    lanEnabled: boolean;
    port: number;
    token: string;
}> => {
    return ipcRenderer.invoke("httpserver:getConfig");
};

const setConfig = async (
    config: any,
): Promise<{ code: number; msg?: string }> => {
    return ipcRenderer.invoke("httpserver:setConfig", config);
};

export default {
    status,
    start,
    stop,
    restart,
    getConfig,
    setConfig,
};
