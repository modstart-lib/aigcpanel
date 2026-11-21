import { Events } from "../mapi/event/main";
import { AppEnv, AppRuntime } from "../mapi/env";
import { PageUser } from "./user";
import { BrowserWindow, shell } from "electron";
import { rendererLoadPath } from "../lib/env-main";
import { PageGuide } from "./guide";
import { PageSetup } from "./setup";
import { DevToolsManager } from "../lib/devtools";
import { PageFeedback } from "./feedback";
import { PagePayment } from "./payment";
import { PageMonitor } from "./monitor";
import { PageLog } from "./log";
import { PageComfyUIView } from "./comfyui-view";

const Pages = {
    user: PageUser,
    guide: PageGuide,
    setup: PageSetup,
    payment: PagePayment,
    feedback: PageFeedback,
    monitor: PageMonitor,
    log: PageLog,
    "comfyui-view": PageComfyUIView,
};

/**
 * Position a window so that it is centered relative to its parent window.
 * Falls back to the center of the current screen when there is no parent.
 */
const centerInParent = (win: BrowserWindow, parent?: BrowserWindow | null) => {
    if (!parent || parent.isDestroyed()) {
        win.center();
        return;
    }
    const parentBounds = parent.getBounds();
    const winBounds = win.getBounds();
    win.setPosition(
        Math.round(parentBounds.x + (parentBounds.width - winBounds.width) / 2),
        Math.round(
            parentBounds.y + (parentBounds.height - winBounds.height) / 2,
        ),
    );
};

export const Page = {
    centerInParent,
    ready(name: string) {
        Events.send(name, "APP_READY", {
            name,
            AppEnv,
        });
    },
    openWindow: (name: string, win: BrowserWindow, fileName: string) => {
        win.webContents.on("will-navigate", (event) => {
            event.preventDefault();
        });
        win.webContents.setWindowOpenHandler(() => {
            return { action: "deny" };
        });
        win.webContents.setWindowOpenHandler(({ url }) => {
            if (url.startsWith("https:") || url.startsWith("http:")) {
                shell.openExternal(url).then();
            }
            return { action: "deny" };
        });
        win.on("close", () => {
            delete AppRuntime.windows[name];
        });
        const promise = new Promise((resolve, reject) => {
            win.webContents.on("did-finish-load", () => {
                win.focus();
                Page.ready(name);
                DevToolsManager.autoShow(win);
                resolve(undefined);
            });
        });
        rendererLoadPath(win, fileName);
        DevToolsManager.register(`Page.${name}`, win);
        AppRuntime.windows[name] = win;
        return promise;
    },
    open: async (
        name: string,
        option?: {
            singleton?: boolean;
            parent?: BrowserWindow;
            [key: string]: any;
        },
    ) => {
        option = Object.assign(
            {
                singleton: true,
                parent: null,
            },
            option,
        );
        if (!option.parent) {
            option.parent = AppRuntime.mainWindow;
        }
        // comfyui-view 由 PageComfyUIView 自己管理"已打开则关闭重建"（每次打开都加载最新工作流），
        // 因此不走 singleton 拦截
        if (
            option.singleton &&
            name !== PageComfyUIView.NAME &&
            AppRuntime.windows[name]
        ) {
            const win = AppRuntime.windows[name];
            win.show();
            win.focus();
            win.setParentWindow(option.parent);
            // Re-center the window relative to its parent (e.g. the user dialog)
            if ((Pages[name] as any).centerOnParent) {
                Page.centerInParent(win, option.parent);
            }
            return;
        }
        return Pages[name].open(option);
    },
    registerWindow(name: string, win: BrowserWindow) {
        AppRuntime.windows[name] = win;
    },
    unregisterWindow(name: string) {
        delete AppRuntime.windows[name];
    },
};
