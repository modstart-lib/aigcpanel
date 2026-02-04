<script setup lang="ts">
import {computed, onMounted, ref, watch} from "vue";
import PageWebviewStatus from "../components/common/PageWebviewStatus.vue";

const status = ref<InstanceType<typeof PageWebviewStatus> | null>(null);
const web = ref<any | null>(null);

const emit = defineEmits({
    event: (type: string, data: any) => true,
});

const webPreload = ref("");
const webUrl = ref("");
const webUserAgent =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";
const pageTitle = ref("");
const pageDebugToolsShow = ref(false);
const pageOpenDevTools = ref(false);
const pageScript = ref("");
const pageStatusType = ref<"info" | "success" | "error">("info");
const pageStatusMsg = ref("");
const pageStatusColor = computed(() => {
    if (pageStatusType.value === "info") {
        return "#000";
    } else if (pageStatusType.value === "success") {
        return "#4caf50";
    } else if (pageStatusType.value === "error") {
        return "#f44336";
    }
    return "#000";
});

window.__page.registerCallPage("MonitorData", (resolve, reject, payload) => {
    const {type, data} = payload;
    if ("SetTitle" == type) {
        pageTitle.value = data.title;
        emit("event", "SetTitle", {title: pageTitle.value});
    } else if ("LoadUrl" == type) {
        status.value?.setStatus("loading");
        pageOpenDevTools.value = data.openDevTools;
        pageScript.value = data.script;
        webUrl.value = data.url;
        emit("event", "SetTitle", {title: pageTitle.value + " " + data.url});
    }
    return resolve(undefined);
});

const doOpenWebDevTools = () => {
    if (web.value) {
        if (web.value.isDevToolsOpened()) {
            web.value.closeDevTools();
        } else {
            web.value.openDevTools();
        }
    }
};

const doRefresh = e => {
    if (e.shiftKey) {
        pageDebugToolsShow.value = !pageDebugToolsShow.value;
        return;
    }
    if (web.value) {
        web.value.reload();
    }
};

watch(web, newVal => {
    if (!newVal) {
        return;
    }
    console.log("webview.listen", newVal);
    web.value.addEventListener("did-fail-load", (event: any) => {
        status.value?.setStatus("fail");
    });
    web.value.addEventListener("did-finish-load", (event: any) => {
        console.log("did-finish-load", event);
    });
    web.value.addEventListener("close", (event: any) => {
        if (web.value.isDevToolsOpened()) {
            web.value.closeDevTools();
        }
    });
    web.value.addEventListener("dom-ready", e => {
        if (pageOpenDevTools.value) {
            web.value.openDevTools();
        }
        if (pageScript.value) {
            window.$mapi.user.apiPost(pageScript.value, {}, {throwException: false}).then(res => {
                if (res.code) {
                    pageStatusMsg.value = `ERROR: ${res.msg}`;
                } else {
                    if (res.data.script) {
                        // console.log('monitor script', res.data.script)
                        web.value.executeJavaScript(`console.log('monitor script run');${res.data.script};`);
                    }
                }
            });
        }
        status.value?.setStatus("success");
    });
    web.value.addEventListener("ipc-message", event => {
        if ("data" === event.channel) {
            const {type, data} = event.args[0];
            console.log("message", {type, data});
            if ("status" === type) {
                pageStatusType.value = data.type;
                pageStatusMsg.value = data.msg;
            } else if ("event" === type) {
                pageStatusType.value = "info";
                // {"type":"Enter","data":{"source":"douyin","username":"啊龟 ","content":"来了"}}
                // Enter ( source: douyin, username: 啊龟 , content: 来了 )
                const format = (data: any) => {
                    const dataList: string[] = [];
                    for (const key in data.data) {
                        dataList.push(`${key}:${data.data[key]}`);
                    }
                    return `<span class="bg-gray-200 leading-6 px-2 rounded">${
                        data.type
                    }</span> <span class="text-gray-600">( ${dataList.join(", ")} )</span>`;
                };
                pageStatusMsg.value = format(data);
                window.__page.ipcSend("MonitorEvent", data.type, data.data);
            }
        }
    });
});

onMounted(async () => {
    webPreload.value = await window.$mapi.app.getPreload();
});
</script>

<template>
    <div class="pb-monitor-container relative">
        <div class="p-2 flex h-12 items-center overflow-hidden">
            <a-button
                shape="round"
                type="primary"
                status="danger"
                class="mr-1"
                v-if="pageDebugToolsShow"
                @click="doOpenWebDevTools"
            >
                {{ $t("monitor.debug") }}
            </a-button>
            <a-button shape="round" type="primary" @click="doRefresh"> {{ $t("monitor.refresh") }} </a-button>
            <div class="ml-2 select-none">
                <div :style="{color: pageStatusColor}" v-html="pageStatusMsg"></div>
            </div>
        </div>
        <div>
            <webview
                ref="web"
                :src="webUrl"
                nodeintegration
                webpreferences="contextIsolation=false,sandbox=false"
                partition="persist:monitor"
                :useragent="webUserAgent"
                :preload="webPreload"
                class="pb-monitor-web"
            ></webview>
        </div>
        <PageWebviewStatus ref="status" />
    </div>
</template>

<style lang="less" scoped>
.pb-monitor-container,
.pb-monitor-web {
    width: 100%;
    height: calc(100vh - 2.5rem - 3rem);
}
</style>
