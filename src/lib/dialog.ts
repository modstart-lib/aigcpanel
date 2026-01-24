import {Message, MessageReturn, Modal} from "@arco-design/web-vue";
import Prompt from "./components/Prompt.vue";
import {h} from "vue";
import {i18n, t} from "../lang";

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
    alertSuccess: (content: string, title: string | null = null): Promise<void> => {
        title = title || t("common.tip");
        return new Promise(resolve => {
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
    alertError: (content: string, title: string | null = null): Promise<void> => {
        title = title || t("common.tip");
        return new Promise(resolve => {
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
                ".arco-message-list .arco-message-loading .arco-message-content"
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
    prompt: (content: string, defaultValue: string = ""): Promise<string | null> => {
        return new Promise(resolve => {
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
