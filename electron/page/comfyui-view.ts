import { BrowserWindow, dialog } from "electron";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { t } from "../config/lang";
import { WindowConfig } from "../config/window";
import { isDev } from "../lib/env";
import { AppRuntime } from "../mapi/env";

/**
 * 打开 ComfyUI Web UI 查看窗口（BrowserWindow）
 * 仅在服务已启动（端口有效）时可用；每次打开都会先关闭旧窗口再新建，
 * 并通过动态 preload 在页面加载早期注入 OpenPaths，
 * 使前端**首次加载即显示目标工作流**（无需注入后 reload，避免闪烁）。
 */
export const PageComfyUIView = {
    NAME: "comfyui-view",
    open: async (option: {
        title?: string;
        url?: string;
        width?: number;
        height?: number;
        comfyuiNames?: string[];
    }) => {
        option = Object.assign(
            {
                title: t("model.comfyuiView") || "ComfyUI",
                width: 1280,
                height: 800,
                url: "",
                comfyuiNames: [],
            },
            option,
        );
        // 单例：已存在则先关闭旧窗口，再打开新的（保证加载的是本次指定的工作流）。
        // 用 close() 正常关闭并等待完全关闭后再创建（destroy() 会残留 preload
        // 相关状态，导致紧随其后的新窗口加载失败）。
        // 若旧窗口有未保存修改，close() 会触发 will-prevent-unload 确认框，由用户决定。
        const existing = AppRuntime.windows[PageComfyUIView.NAME];
        if (existing && !existing.isDestroyed()) {
            delete AppRuntime.windows[PageComfyUIView.NAME];
            await new Promise<void>((resolve) => {
                existing.once("closed", () => resolve());
                existing.close();
                // 兜底：close 被 beforeunload 阻止时强制销毁，避免永久等待
                setTimeout(() => {
                    if (!existing.isDestroyed()) {
                        existing.destroy();
                    }
                    resolve();
                }, 3000);
            });
        }

        // 动态生成 preload 脚本：页面加载早期写入本次工作流的 OpenPaths，
        // 前端 initializeWorkflow 首次加载即恢复目标工作流（无 reload、无闪烁）
        const preloadPath = await writeWorkflowPreload(
            option.comfyuiNames || [],
        );

        const win = new BrowserWindow({
            title: option.title,
            width: option.width,
            height: option.height,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                webSecurity: false,
                webviewTag: true,
                preload: preloadPath || undefined,
            },
            show: true,
            frame: true,
            center: true,
            transparent: false,
            focusable: true,
            alwaysOnTop: false,
        });
        // 清理逻辑放 closed 事件（close() 与 destroy() 都会触发 closed）。
        // 用身份判断：只有关闭的正是当前注册窗口时才从注册表移除，
        // 避免"关闭旧窗口重建新窗口"时旧窗口的 closed 异步触发误删新窗口。
        win.on("closed", () => {
            if (AppRuntime.windows[PageComfyUIView.NAME] === win) {
                delete AppRuntime.windows[PageComfyUIView.NAME];
            }
            if (preloadPath) {
                try {
                    fs.unlinkSync(preloadPath);
                } catch (e) {
                    /* ignore */
                }
            }
        });
        // 工作流有未保存修改时，ComfyUI 前端通过 beforeunload 阻止关闭，
        // 这里拦截并弹出确认框：允许用户选择"放弃修改并关闭"或"取消"。
        // 注意：不调用 event.preventDefault()（保持页面阻止关闭），
        // 用户确认放弃修改后再用 destroy() 强制关闭（绕过 beforeunload）。
        win.webContents.on("will-prevent-unload", () => {
            dialog
                .showMessageBox(win, {
                    type: "warning",
                    title: option.title,
                    message: t("comfyuiView.confirmCloseTitle"),
                    detail: t("comfyuiView.confirmCloseDetail"),
                    buttons: [
                        t("common.cancel"),
                        t("comfyuiView.discardAndClose"),
                    ],
                    defaultId: 0,
                    cancelId: 0,
                })
                .then(({ response }) => {
                    if (response === 1) {
                        // 用户确认放弃修改并关闭
                        win.destroy();
                    }
                    // 否则不处理：窗口保持打开（未保存修改保留）
                })
                .catch(() => {
                    // 对话框异常时保持窗口打开（不丢失用户修改）
                });
        });
        AppRuntime.windows[PageComfyUIView.NAME] = win;
        // 开发模式打开标准 docked devtools（浏览器底部样式），
        // 不使用 DevToolsManager 的自管理独立窗口（会出现白屏/无法关闭问题）
        if (isDev && WindowConfig.alwaysOpenDevTools) {
            win.webContents.openDevTools({ mode: "bottom" });
        }
        if (option.url) {
            await win.loadURL(option.url).catch((e) => {
                console.log("comfyui-view.loadURL.error", e);
            });
        }
        win.show();
        win.focus();
        return win;
    },
};

/**
 * 生成动态 preload 脚本：设置 ComfyUI 前端工作区恢复所需的 localStorage。
 *
 * ComfyUI 前端 initializeWorkflow 检查 localStorage 的 OpenPaths
 * （Comfy.Workflow.LastOpenPaths:<workspace>）并按 paths 恢复工作流标签。
 * preload 在页面文档加载早期执行（同 origin 的 localStorage 可写），
 * 因此首次加载即恢复目标工作流，无需注入后 reload。
 * 无 comfyuiNames 时返回 null（不注入 preload，走 ComfyUI 默认）。
 */
async function writeWorkflowPreload(
    comfyuiNames: string[],
): Promise<string | null> {
    if (!comfyuiNames || comfyuiNames.length === 0) {
        return null;
    }
    const workspaceId = "personal";
    const paths = comfyuiNames.map((k) => "workflows/" + k + ".json");
    const pointer = { workspaceId, paths, activeIndex: 0 };
    const script = `try {
        localStorage.setItem('Comfy.Workflow.LastOpenPaths:${workspaceId}', ${JSON.stringify(JSON.stringify(pointer))});
        localStorage.setItem('Comfy.Workspace.LastWorkspaceId', '${workspaceId}');
        localStorage.setItem('Comfy.Workflow.Persist', 'true');
    } catch (e) {}`;
    const preloadPath = path.join(
        os.tmpdir(),
        `comfyui-view-preload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.js`,
    );
    fs.writeFileSync(preloadPath, script);
    return preloadPath;
}
