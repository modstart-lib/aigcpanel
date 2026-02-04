import {BrowserWindow} from "electron";
import {t} from "../config/lang";
import {preloadDefault} from "../lib/env-main";
import {Events} from "../mapi/event/main";
import {Page} from "./index";

export const PageMonitor = {
    NAME: "monitor",
    open: async (option: {title?: string; width?: number; height?: number; [key: string]: any}) => {
        option = Object.assign(
            {
                title: t("page.monitor.title"),
                width: 700,
                height: 500,
                url: "",
                script: null,
                openDevTools: false,
                broadcastPages: [],
            },
            option
        );
        const win = new BrowserWindow({
            title: option.title,
            width: option.width,
            height: option.height,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                webSecurity: false,
                preload: preloadDefault,
                webviewTag: true,
            },
            show: true,
            frame: false,
            center: true,
            transparent: false,
            focusable: true,
            parent: null,
            alwaysOnTop: false,
        });
        const sendMonitorData = async (type: string, data: any) => {
            return Events.callPage(PageMonitor.NAME, "MonitorData", {type, data});
        };
        win.webContents.on("did-finish-load", () => {
            sendMonitorData("SetTitle", {title: option.title});
            sendMonitorData("LoadUrl", {
                url: option.url,
                script: option.script,
                openDevTools: option.openDevTools,
            });
        });
        win.webContents.on("ipc-message", (event, channel, ...args) => {
            if (channel === "MonitorEvent") {
                const {type, data} = args[0];
                // console.log('MonitorEvent', type, data)
                if (option.broadcastPages.length > 0) {
                    Events.broadcast(
                        "MonitorEvent",
                        {type, data},
                        {
                            pages: option.broadcastPages,
                        }
                    );
                }
            }
        });
        await Page.openWindow(PageMonitor.NAME, win, "page/monitor.html");
    },
};
