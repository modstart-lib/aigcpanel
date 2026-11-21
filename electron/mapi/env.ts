import electron, { BrowserWindow } from "electron";
import { Log } from "./log";

export const AppEnv = {
    isInit: false,
    appRoot: null as string,
    appData: null as string,
    userData: null as string,
    dataRoot: null as string,
    // Default Electron data root (<userData>/data when AIGCPANEL_DATA_ROOT is not set).
    // Compared with dataRoot to tell whether the effective data directory is customized.
    dataRootDefault: null as string,
};

export const AppRuntime = {
    fileHubRoot: null as string,
    splashWindow: null as BrowserWindow,
    mainWindow: null as BrowserWindow,
    windows: {} as Record<string, BrowserWindow>,
};

export const waitAppEnvReady = async () => {
    while (!AppEnv.isInit) {
        await new Promise((resolve) => {
            setTimeout(resolve, 1000);
        });
    }
};

export const callHandleFromMainOrRender = async (name: string, ...args) => {
    if (electron.ipcRenderer) {
        return electron.ipcRenderer.invoke(name, ...args);
    } else {
        // @ts-ignore
        const func = electron.ipcMain._invokeHandlers.get(name);
        if (func) {
            return func(...args);
        } else {
            Log.error(`No handler found for ${name}`);
            return null;
        }
    }
};
