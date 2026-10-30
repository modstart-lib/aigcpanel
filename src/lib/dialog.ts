import { Message, MessageReturn, Modal } from "@arco-design/web-vue";
import { h } from "vue";
import { t } from "../lang";
import Prompt from "./components/Prompt.vue";

let loadingLayers: MessageReturn[] = [];

export const Dialog = {
    tipSuccess: (msg: string) => {
        Message.success(msg);
    },
    tipError: (msg: string) => {
        
        Message.error(msg);
    },
    confirm: (content: string, title: string | null = null): Promise<void> => {
        title = title || t("common.tip");
        return new Promise((resolve, reject) => {
            Modal.confirm({
                title,
                content,
                titleAlign: "start",
                simple: false,
                width: "25rem",
                modalClass: "arco-modal-confirm",
                okText: t("common.confirm"),
                cancelText: t("common.cancel"),
                onOk: () => {
                    resolve();
                },
                onCancel: () => {
                    // reject();
                },
            });
        });
    },
    /**
     * 带自定义主操作按钮的确认框（例如「去添加素材」）。
     * 返回 true 表示用户点了主操作按钮。
     */
    confirmAction: (
        content: any,
        actionText: string,
        title: string | null = null,
    ): Promise<boolean> => {
        title = title || t("common.tip");
        return new Promise((resolve) => {
            Modal.confirm({
                title,
                content,
                titleAlign: "start",
                simple: false,
                width: "28rem",
                modalClass: "arco-modal-confirm",
                okText: actionText,
                cancelText: t("common.cancel"),
                onOk: () => {
                    resolve(true);
                },
                onCancel: () => {
                    resolve(false);
                },
                onClose: () => {
                    resolve(false);
                },
            });
        });
    },
    alertSuccess: (
        content: string,
        title: string | null = null,
    ): Promise<void> => {
        title = title || t("common.tip");
        return new Promise((resolve) => {
            Modal.confirm({
                title,
                content,
                simple: false,
                width: "25rem",
                onOk: () => {
                    resolve();
                },
            });
        });
    },
    alertError: (
        content: string,
        title: string | null = null,
    ): Promise<void> => {
        title = title || t("common.tip");
        return new Promise((resolve) => {
            Modal.confirm({
                title,
                content,
                simple: false,
                width: "25rem",
                onOk: () => {
                    resolve();
                },
            });
        });
    },
    loadingOn: (content: string | null = null) => {
        content = content || t("common.loadingDots");
        const loading = Message.loading({
            content,
            duration: 0,
        });
        loadingLayers.push(loading);
    },
    loadingUpdate: (content: string) => {
        if (loadingLayers.length > 0) {
            const contentContainer = document.querySelector(
                ".arco-message-list .arco-message-loading .arco-message-content",
            );
            if (contentContainer) {
                contentContainer.innerHTML = content;
            }
        }
    },
    loadingOff: () => {
        const loading = loadingLayers.pop();
        if (loading) {
            loading.close();
        }
    },
    prompt: (
        content: string,
        defaultValue: string = "",
    ): Promise<string | null> => {
        return new Promise((resolve) => {
            let inputValue = defaultValue;
            Modal.open({
                title: content,
                simple: false,
                titleAlign: "start",
                content: () => {
                    return h(Prompt, {
                        value: defaultValue,
                        onChange: (value: string) => {
                            inputValue = value;
                        },
                    });
                },
                width: "25rem",
                onOk: () => {
                    resolve(inputValue);
                },
            });
        });
    },
};
