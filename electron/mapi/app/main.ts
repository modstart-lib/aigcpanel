import {
    app,
    BrowserWindow,
    clipboard,
    ipcMain,
    nativeImage,
    nativeTheme,
    screen,
    shell,
} from "electron";
import { AppConfig } from "../../../src/config";
import { CommonConfig } from "../../config/common";
import { WindowConfig } from "../../config/window";
import {
    isDev,
    isMac,
    platformArch,
    platformName,
    platformUUID,
    platformVersion,
} from "../../lib/env";
import { preloadDefault, rendererDistPath } from "../../lib/env-main";
import { Page } from "../../page";
import { ConfigMain } from "../config/main";
import { AppRuntime } from "../env";
import { Events } from "../event/main";
import { Files } from "../file/main";
import Apps from "./index";
import { AppPosition } from "./lib/position";
import { makeLoading } from "./loading";
import { SetupMain } from "./setup";
import { makeToast } from "./toast";

const getWindowByName = (name?: string) => {
    if (!name || "main" === name) {
        return AppRuntime.mainWindow;
    }
    return AppRuntime.windows[name];
};

const getCurrentWindow = (window, e) => {
    let originWindow = BrowserWindow.fromWebContents(e.sender);
    // if (originWindow !== window) originWindow = detachInstance.getWindow();
    return originWindow;
};

const quit = () => {
    // @ts-ignore
    app.quitForce = true;
    app.quit();
};

ipcMain.handle("app:quit", () => {
    quit();
});

const restart = () => {
    app.relaunch();
};

ipcMain.handle("app:restart", () => {
    restart();
});

const windowMin = (name?: string) => {
    getWindowByName(name)?.minimize();
};

const windowMax = (name?: string) => {
    const win = getWindowByName(name);
    if (!win) {
        return;
    }
    if (win.isFullScreen()) {
        win.setFullScreen(false);
        win.unmaximize();
        win.center();
    } else if (win.isMaximized()) {
        win.unmaximize();
        win.center();
    } else {
        win.setMinimumSize(WindowConfig.minWidth, WindowConfig.minHeight);
        win.maximize();
    }
};

const windowSetSize = (
    name: string | null,
    width: number,
    height: number,
    option?: {
        includeMinimumSize: boolean;
        center: boolean;
    },
) => {
    width = parseInt(String(width));
    height = parseInt(String(height));
    // console.log('windowSetSize', name, width, height, option)
    const win = getWindowByName(name);
    if (!win) {
        return;
    }
    option = Object.assign(
        {
            includeMinimumSize: true,
            center: true,
        },
        option,
    );
    if (option.includeMinimumSize) {
        win.setMinimumSize(width, height);
    }
    win.setSize(width, height);
    if (option.center) {
        win.center();
    }
};

ipcMain.handle("app:openExternal", (event, url: string) => {
    return shell.openExternal(url);
});
ipcMain.handle("app:openPath", (event, url: string) => {
    return shell.openPath(url);
});
ipcMain.handle("app:showItemInFolder", (event, url: string) => {
    return shell.showItemInFolder(url);
});

ipcMain.handle("app:getPreload", (event) => {
    let preload = preloadDefault;
    if (!preload.startsWith("file://")) {
        preload = `file://${preload}`;
    }
    return preload;
});

ipcMain.handle("window:min", (event, name: string) => {
    windowMin(name);
});
ipcMain.handle("window:max", (event, name: string) => {
    windowMax(name);
});
ipcMain.handle(
    "window:setSize",
    (
        event,
        name: string | null,
        width: number,
        height: number,
        option?: {
            includeMinimumSize: boolean;
            center: boolean;
        },
    ) => {
        windowSetSize(name, width, height, option);
    },
);

ipcMain.handle("window:close", (event, name: string) => {
    getWindowByName(name)?.close();
});

const windowOpen = async (
    name: string,
    option?: {
        singleton?: boolean;
        parent?: BrowserWindow;
        [key: string]: any;
    },
) => {
    name = name || "main";
    return Page.open(name, option);
};

ipcMain.handle("window:open", async (event, name: string, option: any) => {
    // 窗口对象不能通过 IPC 序列化，仅创建窗口，不返回 BrowserWindow
    await windowOpen(name, option);
});

ipcMain.handle("window:hide", (event, name: string) => {
    getWindowByName(name)?.hide();
    if (isMac) {
        app.dock.hide();
    }
});

ipcMain.handle(
    "window:move",
    (
        event,
        name: string | null,
        data: {
            mouseX: number;
            mouseY: number;
            width: number;
            height: number;
        },
    ) => {
        const { x, y } = screen.getCursorScreenPoint();
        const originWindow = getWindowByName(name);
        if (!originWindow) return;
        originWindow.setBounds({
            x: x - data.mouseX,
            y: y - data.mouseY,
            width: data.width,
            height: data.height,
        });
        AppPosition.set(name, x - data.mouseX, y - data.mouseY);
    },
);

const getClipboardText = () => {
    return clipboard.readText("clipboard");
};

ipcMain.handle("app:getClipboardText", (event) => {
    return getClipboardText();
});

const setClipboardText = (text: string) => {
    clipboard.writeText(text, "clipboard");
};

ipcMain.handle("app:setClipboardText", (event, text: string) => {
    setClipboardText(text);
});

const getClipboardImage = () => {
    const image = clipboard.readImage("clipboard");
    return image.isEmpty() ? "" : image.toDataURL();
};

ipcMain.handle("app:getClipboardImage", (event) => {
    return getClipboardImage();
});

const setClipboardImage = (image: string) => {
    const img = nativeImage.createFromDataURL(image);
    clipboard.writeImage(img, "clipboard");
};

ipcMain.handle("app:setClipboardImage", (event, image: string) => {
    setClipboardImage(image);
});

const isDarkMode = () => {
    if (!CommonConfig.darkModeEnable) {
        return false;
    }
    return nativeTheme.shouldUseDarkColors;
};

const shouldDarkMode = async () => {
    if (!CommonConfig.darkModeEnable) {
        return false;
    }
    const darkMode = (await ConfigMain.get("darkMode")) || "auto";
    if ("dark" === darkMode) {
        return true;
    } else if ("light" === darkMode) {
        return false;
    } else if ("auto" === darkMode) {
        return isDarkMode();
    }
    return false;
};

const defaultDarkModeBackgroundColor = async () => {
    if (await shouldDarkMode()) {
        return "#17171A";
    }
    return "#FFFFFF";
};

nativeTheme.on("updated", () => {
    Events.broadcast("DarkModeChange", { isDarkMode: isDarkMode() });
    AppsMain.defaultDarkModeBackgroundColor().then((color) => {
        AppRuntime.mainWindow.setBackgroundColor(color);
    });
});

ipcMain.handle("app:isDarkMode", () => {
    return isDarkMode();
});

const getCurrentScreenDisplay = () => {
    const screenPoint = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(screenPoint);
    return {
        bounds: display.bounds,
        workArea: display.workArea,
    };
};

const calcPositionInCurrentDisplay = (
    position:
        "center" | "left-top" | "right-top" | "left-bottom" | "right-bottom",
    width: number,
    height: number,
) => {
    const { bounds, workArea } = getCurrentScreenDisplay();
    let x = 0;
    let y = 0;
    switch (position) {
        case "center":
            x = workArea.x + (workArea.width - width) / 2;
            y = workArea.y + (workArea.height - height) / 2;
            break;
        case "left-top":
            x = workArea.x;
            y = workArea.y;
            break;
        case "right-top":
            x = workArea.x + workArea.width - width;
            y = workArea.y;
            break;
        case "left-bottom":
            x = workArea.x;
            y = workArea.y + workArea.height - height;
            break;
        case "right-bottom":
            x = workArea.x + workArea.width - width;
            y = workArea.y + workArea.height - height;
            break;
    }
    return {
        x: Math.round(x),
        y: Math.round(y),
    };
};

const toast = (
    msg: string,
    options?: {
        duration?: number;
        status?: "success" | "error" | "info";
    },
) => {
    return makeToast(msg, options);
};

ipcMain.handle("app:toast", (event, msg: string, option?: any) => {
    return toast(msg, option);
});

const loading = (
    msg: string,
    options?: {
        timeout?: number;
        percentAuto?: boolean;
        percentTotalSeconds?: number;
    },
): {
    close: () => void;
    percent: (value: number) => void;
} => {
    return makeLoading(msg, options);
};

ipcMain.handle("app:loading", (event, msg: string, option?: any) => {
    return loading(msg, option);
});

ipcMain.handle("app:setupList", async () => {
    return SetupMain.list();
});

ipcMain.handle("app:setupOpen", async (event, name: string) => {
    return SetupMain.open(name);
});

const setupIsOk = async () => {
    return SetupMain.isOk();
};

ipcMain.handle("app:setupIsOk", async () => {
    return setupIsOk();
});

const getBuildInfo = async () => {
    if (isDev) {
        return {
            buildId: "Development",
        };
    }
    const json = await Files.read(rendererDistPath("build.json"), {
        isDataPath: false,
    });
    return JSON.parse(json);
};

ipcMain.handle("app:getBuildInfo", async () => {
    return getBuildInfo();
});

const collect = async (options?: {}) => {
    return {
        userAgent: Apps.getUserAgent(),
        name: AppConfig.name,
        version: AppConfig.version,
        uuid: platformUUID(),
        platformVersion: platformVersion(),
        platformName: platformName(),
        platformArch: platformArch(),
    };
};

ipcMain.handle("app:collect", async (event, options?: {}) => {
    return collect(options);
});

const setAutoLaunch = async (enable: boolean, options?: {}) => {
    return app.setLoginItemSettings({
        openAtLogin: enable,
    });
};

ipcMain.handle(
    "app:setAutoLaunch",
    async (event, enable: boolean, options?: {}) => {
        return setAutoLaunch(enable, options);
    },
);

const getAutoLaunch = async (options?: {}) => {
    return app.getLoginItemSettings().openAtLogin;
};

ipcMain.handle("app:getAutoLaunch", async (event, options?: {}) => {
    return getAutoLaunch(options);
});

export default {
    quit,
};

export const AppsMain = {
    shouldDarkMode,
    defaultDarkModeBackgroundColor,
    getWindowByName,
    getClipboardText,
    setClipboardText,
    getClipboardImage,
    setClipboardImage,
    getCurrentScreenDisplay,
    calcPositionInCurrentDisplay,
    toast,
    loading,
    setupIsOk,
    windowOpen,
};
