import { reactive } from "vue";

export type OfflineAuthRequest = {
    /** 设备码 */
    machineId?: string;
    /** 包名（= 模型包 config.json 的 name） */
    packageName?: string;
    version?: string;
    reason?: string;
    /** 已有授权码（「AI模型」管理里查看/修改时预填） */
    token?: string;
    /** 授权归属的模型信息（撤销授权时需要） */
    serverInfo?: any;
};

// 全局离线授权弹窗状态：主进程检测到 launcher 的 AigcPanelOfflineAuth[...] 标记后，
// 由 server store 调用 require() 弹出输入框；OfflineAuthDialog 组件负责渲染。
const state = reactive({
    visible: false,
    request: null as OfflineAuthRequest | null,
});

let resolver: ((value: string | null) => void) | null = null;

export const OfflineAuth = {
    state,
    // 弹出授权输入框，返回授权码（取消返回 null）；软件名称在弹窗内校验
    require(request: OfflineAuthRequest): Promise<string | null> {
        // 同一时间只允许一个弹窗：上一个未决的请求按取消处理
        if (resolver) {
            const previous = resolver;
            resolver = null;
            previous(null);
        }
        state.request = request || {};
        state.visible = true;
        return new Promise((resolve) => {
            resolver = resolve;
        });
    },
    resolve(value: string | null) {
        // 先置空 resolver，避免 visible 变化触发组件 setter 递归 resolve
        const current = resolver;
        resolver = null;
        state.visible = false;
        if (current) {
            current(value);
        }
    },
};
