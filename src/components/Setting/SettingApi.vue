<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, computed } from "vue";
import { t, getLocale } from "../../lang";
import MarkdownDocViewer from "../common/MarkdownDocViewer.vue";
import apiDocContent from "../../docs/api-doc.md?raw";
import apiDocContentEn from "../../docs/api-doc.en.md?raw";

const apiDocVisible = ref(false);

// 当前语言
const currentLocale = ref("zh-CN");

// 根据当前语言选择文档内容
const docContent = computed(() => {
    return currentLocale.value.startsWith("en")
        ? apiDocContentEn
        : apiDocContent;
});

// Server status
const running = ref(false);
const port = ref(0);
const localAddr = ref("127.0.0.1");
const lanAddr = ref("");

// Config
const lanEnabled = ref(false);
const editingToken = ref("");
const savedToken = ref("");

// LAN service address shown when LAN access is enabled
const lanServiceAddr = computed(() => {
    return lanAddr.value && port.value ? `${lanAddr.value}:${port.value}` : "";
});

// Local (loopback) service address
const localServiceAddr = computed(() => {
    return `${localAddr.value}:${port.value || "-"}`;
});

// Effective listen address: LAN IP when enabled, otherwise loopback
const effectiveServiceAddr = computed(() => {
    return lanEnabled.value
        ? lanServiceAddr.value || "-"
        : localServiceAddr.value;
});

// ── Lifecycle ────────────────────────────────────────────────────────────

let pollTimer: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
    currentLocale.value = await getLocale();
    await loadConfig();
    await loadStatus();
    pollTimer = setInterval(async () => {
        await loadStatus();
    }, 3000);
});

onBeforeUnmount(() => {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
});

async function loadConfig() {
    const c = await window.$mapi.httpserver.getConfig();
    lanEnabled.value = c.lanEnabled;
    savedToken.value = c.token || "";
    editingToken.value = savedToken.value;
}

async function loadStatus() {
    const s = await window.$mapi.httpserver.status();
    running.value = s.running;
    port.value = s.port;
    localAddr.value = s.localAddr;
    lanAddr.value = s.lanAddr;
}

// ── Actions ──────────────────────────────────────────────────────────────

async function toggleLan() {
    const newVal = !lanEnabled.value;
    const res = await window.$mapi.httpserver.setConfig({
        lanEnabled: newVal,
    });
    if (res.code === 0) {
        lanEnabled.value = newVal;
        await loadStatus();
        window.$mapi.app.toast(
            newVal ? t("api.lanOnMsg") : t("api.lanOffMsg"),
            { status: "success" },
        );
    } else {
        window.$mapi.app.toast(res.msg || t("common.failed"), {
            status: "error",
        });
    }
}

async function saveToken() {
    const v = editingToken.value.trim();
    if (!v) {
        window.$mapi.app.toast(t("api.tokenRequired"), { status: "error" });
        editingToken.value = savedToken.value;
        return;
    }
    if (v === savedToken.value) return;
    const res = await window.$mapi.httpserver.setConfig({ token: v });
    if (res.code === 0) {
        savedToken.value = v;
        editingToken.value = v;
        await loadStatus();
        window.$mapi.app.toast(t("api.tokenSaved"), { status: "success" });
    } else {
        window.$mapi.app.toast(res.msg || t("common.failed"), {
            status: "error",
        });
        editingToken.value = savedToken.value;
    }
}
</script>

<template>
    <div>
        <!-- 局域网访问 -->
        <div class="flex mb-3 items-center">
            <div class="w-24 flex-shrink-0">{{ t("api.lanAccess") }}</div>
            <div class="flex items-center gap-3">
                <a-switch :model-value="lanEnabled" @change="toggleLan" />
                <span v-if="lanEnabled" class="text-green-600 text-sm">
                    {{ t("api.lanOn") }}
                </span>
                <span v-else class="text-gray-400 text-sm">
                    {{ t("api.lanOff") }}
                </span>
                <span class="text-xs text-gray-400">
                    {{ t("api.lanHint") }}
                </span>
            </div>
        </div>

        <!-- 访问 Token -->
        <div class="flex mb-3 items-center">
            <div class="w-24 flex-shrink-0">{{ t("api.accessToken") }}</div>
            <div class="flex items-center gap-2">
                <a-input-password
                    v-model="editingToken"
                    :placeholder="t('api.accessTokenPlaceholder')"
                    style="width: 320px"
                    @blur="saveToken"
                    @press-enter="saveToken"
                />
                <span class="text-xs text-gray-400">
                    {{ t("api.tokenHint") }}
                </span>
            </div>
        </div>

        <!-- 文档 -->
        <div class="flex mb-3">
            <div class="w-24 flex-shrink-0">{{ $t("common.docs") }}</div>
            <div class="flex-grow">
                <a-button @click="apiDocVisible = true">
                    <template #icon><icon-file /></template>
                    {{ t("api.viewDoc") }}
                </a-button>
            </div>
        </div>

        <!-- 服务地址 -->
        <div class="flex mb-3 items-start">
            <div class="w-24 flex-shrink-0">{{ t("api.serviceAddr") }}</div>
            <div class="flex flex-col gap-1 text-sm">
                <div class="flex items-center gap-2">
                    <span
                        class="inline-block w-2 h-2 rounded-full"
                        :class="running ? 'bg-green-500' : 'bg-gray-300'"
                    ></span>
                    <span class="font-mono text-gray-700 dark:text-gray-300">
                        {{ effectiveServiceAddr }}
                    </span>
                    <span v-if="running" class="text-xs text-green-600">
                        {{ t("api.running") }}
                    </span>
                    <span v-else class="text-xs text-gray-400">
                        {{ t("api.stopped") }}
                    </span>
                </div>
                <div v-if="lanEnabled" class="flex items-center gap-2">
                    <span class="text-xs text-gray-400">
                        {{ t("api.localAddrLabel") }}
                    </span>
                    <span class="font-mono text-gray-700 dark:text-gray-300">
                        {{ localServiceAddr }}
                    </span>
                </div>
            </div>
        </div>

        <!-- 完整文档弹窗 -->
        <a-modal
            v-model:visible="apiDocVisible"
            :width="'min(900px, 92vw)'"
            :footer="false"
            title-align="start"
            modal-class="modal-independent-scroll"
            :body-style="{ padding: '0', height: 'calc(100vh - 12rem)' }"
            :modal-style="{ 'max-height': 'calc(100vh - 4rem)' }"
        >
            <template #title
                ><div class="font-bold">{{ t("api.viewDoc") }}</div></template
            >
            <MarkdownDocViewer :content="docContent" />
        </a-modal>
    </div>
</template>

<style scoped></style>
