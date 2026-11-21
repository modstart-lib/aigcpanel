import { ipcRenderer } from "electron";
import updaterIndex, {
    type UpdaterAsset,
    type UpdaterDownloadChannel,
} from "./index";

const getCheckAtLaunch = async (): Promise<"yes" | "no"> => {
    return ipcRenderer.invoke("updater:getCheckAtLaunch");
};

const setCheckAtLaunch = async (value: "yes" | "no"): Promise<void> => {
    return ipcRenderer.invoke("updater:setCheckAtLaunch", value);
};

const getState = async () => {
    return ipcRenderer.invoke("updater:getState");
};

const checkForUpdate = async () => {
    return ipcRenderer.invoke("updater:check");
};

const probe = async (channels: UpdaterDownloadChannel[]) => {
    return ipcRenderer.invoke("updater:probe", channels);
};

const download = async (payload?: { url?: string; asset?: UpdaterAsset }) => {
    return ipcRenderer.invoke("updater:download", payload);
};

const cancelDownload = async () => {
    return ipcRenderer.invoke("updater:cancelDownload");
};

const preflight = async () => {
    return ipcRenderer.invoke("updater:preflight");
};

const stopBlockers = async () => {
    return ipcRenderer.invoke("updater:stopBlockers");
};

const install = async () => {
    return ipcRenderer.invoke("updater:install");
};

const openDownloadedFile = async () => {
    return ipcRenderer.invoke("updater:openDownloadedFile");
};

const openDownloadPage = async () => {
    return ipcRenderer.invoke("updater:openDownloadPage");
};

const onState = (cb: (state: any) => void) => {
    window.__page.onBroadcast("UpdaterState", cb);
    return () => window.__page.offBroadcast("UpdaterState", cb);
};

export default {
    ...updaterIndex,
    getCheckAtLaunch,
    setCheckAtLaunch,
    getState,
    checkForUpdate,
    probe,
    download,
    cancelDownload,
    preflight,
    stopBlockers,
    install,
    openDownloadedFile,
    openDownloadPage,
    onState,
};
