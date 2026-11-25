import { app, BrowserWindow, desktopCapturer, session, shell } from "electron";
import { optimizer } from "@electron-toolkit/utils";
import * as remoteMain from "@electron/remote/main";
import path from "node:path";
import fs from "node:fs";

/** process.js 必须位于非依赖项的顶部 */
import { isDummy } from "../lib/process";
import { AppEnv, AppRuntime } from "../mapi/env";
import { MAPI } from "../mapi/main";

import { WindowConfig } from "../config/window";
import { AppConfig } from "../../src/config";
import Log from "../mapi/log/main";
import { ConfigMenu } from "../config/menu";
import { ConfigLang, t } from "../config/lang";
import { ConfigContextMenu } from "../config/contextMenu";
import { preloadDefault, rendererLoadPath } from "../lib/env-main";
import { Page } from "../page";
import { ConfigTray } from "../config/tray";
import { icnsLogoPath, icoLogoPath, logoPath } from "../config/icon";
import { isDev, isMac, isPackaged } from "../lib/env";
import { executeHooks } from "../lib/hooks";
import { loadClientConfig } from "../lib/clientConfig";
import { DevToolsManager } from "../lib/devtools";
import { Diagnostics } from "../lib/diagnostics";
import { AppsMain } from "../mapi/app/main";
import { ServerMain } from "../mapi/server/main";
import { DBMain } from "../mapi/db/main";
import {
    normalizeQuitTaskCount,
    quitTaskCountQuery,
    quitWorkflowCountQuery,
} from "../../src/lib/quitGuard";
import { HttpServerMain } from "../mapi/httpserver/main";
import ConfigMain from "../mapi/config/main";
import { reportError } from "../mapi/log/beacon";

const isDummyNew = isDummy;

if (process.env["ELECTRON_ENV_PROD"]) {
    DevToolsManager.setEnable(false);
}

process.on("uncaughtException", (reason) => {
    let error: any = reason;
    if (error instanceof Error) {
        error = [error.message, error.stack].join("\n");
    }
    Log.error("UncaughtException", error);
    reportError(
        reason instanceof Error ? reason.message : String(reason),
        reason instanceof Error ? reason.stack : undefined,
    );
});

process.on("unhandledRejection", (reason) => {
    Log.error("UnhandledRejection", reason);
    let error: any = reason;
    if (error instanceof Error) {
        error = [error.message, error.stack].join("\n");
    }
    Log.error("UnhandledRejection", error);
    reportError(
        reason instanceof Error ? (reason as Error).message : String(reason),
        reason instanceof Error ? (reason as Error).stack : undefined,
    );
});

// Runtime diagnostics: renderer crashes, unresponsive windows, load failures,
// child (GPU/utility) process crashes and periodic memory snapshots, all
// written to the standard log file for post-mortem analysis. Must be
// registered before any window is created.
Diagnostics.register();

// Ensure consistent app name (macOS uses Info.plist CFBundleName from the dev binary,
// which would be "Electron" instead of "aigcpanel" without this explicit override)
if (app.getName() !== "aigcpanel") {
    app.setName("aigcpanel");
}

// 数据目录覆盖：AIGCPANEL_DATA_ROOT 环境变量（有值时）重定向整个 userData 目录，
// 使 database.db / storage / config.json / cli-auth.json / logs 及单实例锁全部落到独立目录，
// 实现「正式使用数据与开发测试完全隔离」。
// 必须在 requestSingleInstanceLock() 与 app.getPath("userData") 之前执行，否则锁文件与
// 后续所有 userData 相关路径仍会落在默认目录。
// Record the default Electron userData before redirecting it via setPath("userData", ...),
// so the setup page can tell whether the effective data directory has been customized.
const defaultUserData = app.getPath("userData");

const clientConfig = loadClientConfig();
if (clientConfig.dataPath) {
    app.setPath("userData", clientConfig.dataPath);
}

app.disableHardwareAcceleration();

// Set application name for Windows 10+ notifications
if (process.platform === "win32") app.setAppUserModelId(app.getName());

if (!app.requestSingleInstanceLock()) {
    app.quit();
    process.exit(0);
}

const hasSplashWindow = true;

AppEnv.appRoot = process.env.APP_ROOT;
AppEnv.appData = app.getPath("appData");
AppEnv.userData = app.getPath("userData");
AppEnv.dataRoot = path.join(AppEnv.userData, "data");
AppEnv.dataRootDefault = path.join(defaultUserData, "data");

if (!fs.existsSync(AppEnv.dataRoot)) {
    fs.mkdirSync(AppEnv.dataRoot, { recursive: true });
}
for (const dir of ["logs", "storage"]) {
    if (!fs.existsSync(path.join(AppEnv.dataRoot, dir))) {
        fs.mkdirSync(path.join(AppEnv.dataRoot, dir), { recursive: true });
    }
}

AppEnv.isInit = true;

// @electron/remote requires its main-process IPC handlers to be installed before
// any window calls `main.enable(webContents)`; without this the renderer's
// `require("@electron/remote")` blocks forever on the sync IPC reply.
if (!remoteMain.isInitialized()) {
    remoteMain.initialize();
}

MAPI.init();
ConfigContextMenu.init();

Log.info("Starting");
Log.info("LaunchInfo", {
    isPackaged,
    userData: AppEnv.userData,
    dataRoot: AppEnv.dataRoot,
});

async function createWindow() {
    let icon = logoPath;
    if (process.platform === "win32") {
        icon = icoLogoPath;
    } else if (process.platform === "darwin") {
        icon = icnsLogoPath;
    }
    if (hasSplashWindow) {
        AppRuntime.splashWindow = new BrowserWindow({
            title: AppConfig.title,
            width: 600,
            height: 350,
            transparent: true,
            frame: false,
            alwaysOnTop: true,
            hasShadow: true,
            skipTaskbar: true,
        });
        rendererLoadPath(AppRuntime.splashWindow, "splash.html");
    }
    AppRuntime.mainWindow = new BrowserWindow({
        show: !hasSplashWindow,
        title: AppConfig.title,
        ...(!isPackaged ? { icon } : {}),
        frame: false,
        transparent: false,
        hasShadow: true,
        center: true,
        minWidth: WindowConfig.initWidth,
        minHeight: WindowConfig.initHeight,
        width: WindowConfig.initWidth,
        height: WindowConfig.initHeight,
        backgroundColor: await AppsMain.defaultDarkModeBackgroundColor(),
        titleBarStyle: "hidden",
        trafficLightPosition: { x: 10, y: 11 },
        backgroundThrottling: false,
        webPreferences: {
            preload: preloadDefault,
            // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
            nodeIntegration: true,
            webSecurity: false,
            webviewTag: true,
            // Consider using contextBridge.exposeInMainWorld
            // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
            contextIsolation: false,
            // sandbox: false,
        },
    });

    AppRuntime.mainWindow.on("closed", () => {
        AppRuntime.mainWindow = null;
    });
    AppRuntime.mainWindow.on("show", async () => {
        await executeHooks(AppRuntime.mainWindow, "Show");
    });
    AppRuntime.mainWindow.on("hide", async () => {
        await executeHooks(AppRuntime.mainWindow, "Hide");
    });

    // 关闭窗口先确认（所有平台）：不拦的话 Windows/Linux 会走
    // window-all-closed -> app.quit，主窗口被销毁后再被 before-quit 拦下，
    // 就成了「窗口没了、toast 窗口反复开关」的状态
    AppRuntime.mainWindow.on("close", (event) => {
        if (!(app as any).quitForce && !isDev) {
            executeHooks(AppRuntime.mainWindow, "ShowQuitConfirmDialog");
            event.preventDefault();
        }
    });
    AppRuntime.mainWindow.on("enter-full-screen", () => {
        executeHooks(AppRuntime.mainWindow, "EnterFullScreen");
    });
    AppRuntime.mainWindow.on("leave-full-screen", () => {
        executeHooks(AppRuntime.mainWindow, "LeaveFullScreen");
    });

    rendererLoadPath(AppRuntime.mainWindow, "index.html");
    DevToolsManager.register("Main", AppRuntime.mainWindow);

    AppRuntime.mainWindow.webContents.on("did-finish-load", () => {
        if (hasSplashWindow) {
            AppRuntime.mainWindow?.show();
            setTimeout(() => {
                try {
                    AppRuntime.splashWindow?.close();
                    AppRuntime.splashWindow = null;
                    // AppRuntime.mainWindow.webContents.openDevTools({
                    //     mode: 'detach',
                    // })
                } catch (e) {}
            }, 1000);
        }
        Page.ready("main");
        DevToolsManager.autoShow(AppRuntime.mainWindow);
    });
    AppRuntime.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith("https:")) shell.openExternal(url);
        return { action: "deny" };
    });
}

app.whenReady()
    .then(() => {
        session.defaultSession.setDisplayMediaRequestHandler(
            (request, callback) => {
                desktopCapturer
                    .getSources({ types: ["screen"] })
                    .then((sources) => {
                        // Grant access to the first screen found.
                        callback({ video: sources[0], audio: "loopback" });
                    });
            },
        );
    })
    .then(ConfigLang.readyAsync)
    .then(() => {
        MAPI.ready();
        ConfigMenu.ready();
        ConfigTray.ready();
        HttpServerMain.start().catch((err: any) => {
            Log.error("HttpServer auto-start failed", err);
        });
        app.on("browser-window-created", (_, window) => {
            optimizer.watchWindowShortcuts(window);
        });
        createWindow().then();
    });

const isMainRendererAlive = () => {
    const win = AppRuntime.mainWindow;
    if (!win || win.isDestroyed()) {
        return false;
    }
    return !!win.webContents && !win.webContents.isDestroyed();
};

/**
 * 未完成任务数：运行中 + 排队中的用户任务，加上正在运行的工作流。
 * 数据库未就绪或查询失败时返回 0（不拦截），避免用户退不出应用。
 */
const getUnfinishedTaskCount = async (): Promise<number> => {
    try {
        const taskQuery = quitTaskCountQuery();
        const taskRow = await DBMain.first(taskQuery.sql, taskQuery.params);
        const counts = normalizeQuitTaskCount(taskRow);
        const workflowQuery = quitWorkflowCountQuery();
        const workflowRow = await DBMain.first(
            workflowQuery.sql,
            workflowQuery.params,
        );
        const workflowCount = Number(workflowRow?.cnt || 0);
        return (
            counts.running +
            counts.queued +
            (Number.isFinite(workflowCount) && workflowCount > 0
                ? Math.floor(workflowCount)
                : 0)
        );
    } catch (e) {
        Log.error("App.beforeQuit.taskCheck.error", e);
        return 0;
    }
};

const showQuitBlocked = (taskCount: number) => {
    if (taskCount > 0) {
        AppsMain.toast(
            t("app.exitTasksRunningHint", {
                count: taskCount,
            }),
        );
        // 把主窗口和退出面板带出来：托盘/Cmd+Q 只有 toast 的话，用户不知道去停什么
        const win = AppRuntime.mainWindow;
        if (win && !win.isDestroyed()) {
            try {
                if (isMac) {
                    app.dock.show();
                }
                if (win.isMinimized()) {
                    win.restore();
                }
                win.show();
                win.focus();
                executeHooks(win, "ShowQuitConfirmDialog", {
                    force: true,
                });
            } catch (e) {
                Log.error("App.beforeQuit.showBlocked.error", e);
            }
        }
        return;
    }
    AppsMain.toast(
        t("app.localServersRunningQuitHint", {
            count: ServerMain.getRunningServerCount(),
        }),
    );
};

let quitCheckRunning = false;

app.on("before-quit", (event) => {
    // 自动升级流程已经在预检阶段停止所有服务与任务，允许直接退出
    if ((app as any).updateQuit) {
        return;
    }
    // 本次退出已经通过检查：放行（quitForce 让窗口可以真正关闭）
    if ((app as any).quitApproved) {
        (app as any).quitForce = true;
        return;
    }
    event.preventDefault();
    if (quitCheckRunning) {
        return;
    }
    quitCheckRunning = true;
    // 渲染进程已经销毁时任务不可能继续跑，只保留本地服务检查
    const taskPromise = isMainRendererAlive()
        ? getUnfinishedTaskCount()
        : Promise.resolve(0);
    taskPromise
        .then((taskCount) => {
            quitCheckRunning = false;
            const serverCount = ServerMain.getRunningServerCount();
            if (taskCount <= 0 && serverCount <= 0) {
                (app as any).quitApproved = true;
                (app as any).quitForce = true;
                app.quit();
                return;
            }
            // 被拦下：复位 quitForce，保证下次关窗仍会弹确认
            (app as any).quitForce = false;
            (app as any).quitApproved = false;
            showQuitBlocked(taskCount);
        })
        .catch((e) => {
            quitCheckRunning = false;
            Log.error("App.beforeQuit.error", e);
            (app as any).quitApproved = true;
            (app as any).quitForce = true;
            app.quit();
        });
});

app.on("will-quit", () => {
    MAPI.destroy();
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

app.on("second-instance", () => {
    if (AppRuntime.mainWindow) {
        if (AppRuntime.mainWindow.isMinimized()) {
            AppRuntime.mainWindow.restore();
        }
        AppRuntime.mainWindow.show();
        AppRuntime.mainWindow.focus();
    }
});

app.on("activate", () => {
    const allWindows = BrowserWindow.getAllWindows();
    if (allWindows.length) {
        if (!AppRuntime.mainWindow.isVisible()) {
            AppRuntime.mainWindow.show();
        }
        AppRuntime.mainWindow.focus();
    } else {
        createWindow().then();
    }
});
