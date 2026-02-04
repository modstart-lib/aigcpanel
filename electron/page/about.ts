import {BrowserWindow} from "electron";
import {t} from "../config/lang";
import {WindowConfig} from "../config/window";
import {preloadDefault} from "../lib/env-main";
import {Page} from "./index";

export const PageAbout = {
    NAME: "about",
    open: async (option: any) => {
        const win = new BrowserWindow({
            title: t("page.about.title"),
            parent: null,
            minWidth: WindowConfig.aboutWidth,
            minHeight: WindowConfig.aboutHeight,
            width: WindowConfig.aboutWidth,
            height: WindowConfig.aboutHeight,
            webPreferences: {
                preload: preloadDefault,
                // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
                nodeIntegration: true,
                webSecurity: false,
                webviewTag: true,
                // Consider using contextBridge.exposeInMainWorld
                // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
                contextIsolation: false,
            },
            show: true,
            frame: false,
            transparent: false,
        });
        return Page.openWindow(PageAbout.NAME, win, "page/about.html");
    },
};
