import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";

import ArcoVue, { Message } from "@arco-design/web-vue";
import "@arco-design/web-vue/dist/arco.css";
import ArcoVueIcon from "@arco-design/web-vue/es/icon";

import { zhCN } from "date-fns/locale";
import timeago from "vue-timeago3";

import { i18n, t } from "./lang";

import { Dialog } from "./lib/dialog";
import "./style.less";

import { CommonComponents } from "./components/common";
import { useSettingStore } from "./store/modules/setting";
import { useServerStore } from "./store/modules/server";
import { useModelStore } from "./module/Model/store/model";
import { TaskManager } from "./task";

import { reportErrorRender } from "../electron/mapi/log/beacon-render";
import { TaskService } from "./service/TaskService";
import { useTaskStore } from "./store/modules/task";
import {
    initTestRegistry,
    registerGetTask,
    registerNavigate,
    testPushError,
    testRegistry,
} from "./utils/test";

// ── Runtime diagnostics: log locally first, then report remotely ──────────
const logRendererInfo = (label: string, data: any = null) => {
    try {
        window.$mapi?.log?.info(`renderer.${label}`, data);
    } catch (e) {}
};
const logRendererError = (label: string, data: any = null) => {
    try {
        window.$mapi?.log?.error(`renderer.${label}`, data);
    } catch (e) {}
};

// Boot marker. If it never appears in the log, the bundle did not run at all
// (a resource / load failure); if it appears but "mounted" does not, the crash
// happened during mount.
logRendererInfo("boot", {
    href: location.href,
    ua: navigator.userAgent,
});

// Registered before mount on purpose: startup / mount errors are the most
// common cause of a white screen, and were previously missed because the
// handlers were only attached after `app.mount` resolved.
window.addEventListener("error", (ev) => {
    testPushError(ev.message || String(ev));
    logRendererError("window.error", {
        message: ev.message,
        stack: ev.error?.stack,
        filename: ev.filename,
        lineno: ev.lineno,
        colno: ev.colno,
    });
    reportErrorRender(
        ev.message,
        ev.error?.stack,
        ev.filename,
        ev.lineno,
        ev.colno,
    );
});

window.addEventListener("unhandledrejection", (ev) => {
    const err = ev.reason;
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    testPushError(msg);
    logRendererError("window.unhandledrejection", { message: msg, stack });
    reportErrorRender(msg, stack);
});

const settingStore = useSettingStore();

const app = createApp(App);

// Vue render / lifecycle errors: usually what turns a working page blank.
app.config.errorHandler = (err, instance, info) => {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    logRendererError("vue.errorHandler", { message: msg, stack, info });
    reportErrorRender(
        msg,
        stack,
        undefined,
        undefined,
        undefined,
        "/renderer/vue",
    );
};

// Router navigation errors (bad route / lazy chunk load failure).
router.onError((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    logRendererError("router.error", { message: msg, stack });
    reportErrorRender(
        msg,
        stack,
        undefined,
        undefined,
        undefined,
        "/renderer/router",
    );
});

app.use(ArcoVue);
app.use(ArcoVueIcon);
app.use(timeago, {
    converterOptions: {
        includeSeconds: false,
    },
    locale: zhCN,
});
app.use(CommonComponents);
app.use(i18n);
app.use(store);
app.use(router);
Message._context = app._context;
app.config.globalProperties.$mapi = window.$mapi;
app.config.globalProperties.$dialog = Dialog;
app.config.globalProperties.$t = t as any;
TaskManager.init();

// 注册工作流 channel 监听器：主进程调度 → 渲染进程执行
window["__page"].channel["workflow:execute"] = async ({
    workflowLogId,
    params,
}: {
    workflowLogId: string;
    params: any;
}) => {
    const taskStore = useTaskStore();
    taskStore.dispatch("Workflow", workflowLogId, params).then();
};
window["__page"].channel["workflow:cancel"] = async ({
    workflowLogId,
}: {
    workflowLogId: string;
}) => {
    const taskStore = useTaskStore();
    taskStore.requestCancel("Workflow", workflowLogId);
};

app.mount("#app").$nextTick(() => {
    postMessage({ payload: "removeLoading" }, "*");
    logRendererInfo("mounted", { href: location.href });

    initTestRegistry();
    window.__test = testRegistry;
    // 供测试种子脚本（test/dev-seed.ts）在写入 storage 后重新加载内存 store
    window["__debug"] = {
        reloadServerStore: () => useServerStore().reloadRecords(),
        reloadModelStore: () => useModelStore().init(),
        getServerRecords: () =>
            useServerStore().records.map((r) => ({
                name: r.name,
                version: r.version,
                functions: r.functions,
            })),
    };
    registerNavigate(async (path) => {
        await router.push(path);
    });
    registerGetTask(async (taskId) => {
        return await TaskService.get(taskId);
    });
});
