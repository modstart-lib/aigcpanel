<script setup lang="ts">
import { computed, ref } from "vue";
import { t } from "../../lang";
import { formatPrepareBytes } from "../../lib/prepareDownload";
import { useServerStore } from "../../store/modules/server";

// 权重按需下载：启动后第一次需要下载权重时先问一次（模型数量、合计体积、磁盘剩余）。
// 挂在 Main.vue 上，用户停在任何页面都能看到。
const serverStore = useServerStore();

const prompt = computed(() => serverStore.preparePrompt);
const visible = computed(() => !!serverStore.preparePrompt);

const titles = computed(() => {
    const keys = prompt.value?.keys || [];
    return keys
        .map((key) => serverStore.records.find((r) => r.key === key))
        .filter((record) => !!record)
        .map((record) => record.title || record.name);
});

const count = computed(() => prompt.value?.count || 0);
const bytes = computed(() => prompt.value?.bytes || 0);
const sizeText = computed(() => formatPrepareBytes(bytes.value));
const freeText = computed(() => formatPrepareBytes(prompt.value?.freeBytes));

// 剩余空间不够时只提示，是否继续由用户决定（可能想先下其中小的模型）
const spaceShort = computed(() => (prompt.value?.shortfall || 0) > 0);
const shortText = computed(() => formatPrepareBytes(prompt.value?.shortfall));
const multiDisk = computed(() => (prompt.value?.diskCount || 0) > 1);

const starting = ref(false);
const doStart = async () => {
    if (starting.value) {
        return;
    }
    starting.value = true;
    try {
        await serverStore.confirmPreparePrompt();
    } finally {
        starting.value = false;
    }
};
const doLater = async () => {
    await serverStore.dismissPreparePrompt();
};
</script>

<template>
    <a-modal
        :visible="visible"
        width="min(600px, 95vw)"
        title-align="start"
        :title="t('service.prepareConfirmTitle')"
        :mask-closable="false"
        :closable="false"
        :esc-to-close="false"
        @cancel="doLater()"
    >
        <div class="text-sm text-gray-600 dark:text-gray-300">
            {{
                t("service.prepareConfirmContent", {
                    count: count,
                    size: sizeText,
                })
            }}
        </div>
        <div
            v-if="titles.length"
            class="mt-3 rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2 text-xs leading-6 text-gray-600 dark:text-gray-300"
        >
            <div v-for="(title, index) in titles.slice(0, 5)" :key="index">
                {{ title }}
            </div>
            <div v-if="titles.length > 5" class="text-gray-400">
                {{
                    t("service.prepareConfirmMore", {
                        count: titles.length - 5,
                    })
                }}
            </div>
        </div>
        <div
            v-if="prompt && prompt.freeBytes !== null"
            class="mt-3 text-xs"
            :class="spaceShort ? 'text-red-500' : 'text-gray-500'"
        >
            {{
                spaceShort
                    ? t("status.prepareShort", { size: shortText })
                    : multiDisk
                      ? t("status.diskFreeMulti", { size: freeText })
                      : t("status.diskFree", { size: freeText })
            }}
        </div>
        <div class="mt-3 text-xs text-gray-400">
            {{ t("service.prepareConfirmLaterTip") }}
        </div>
        <template #footer>
            <a-button @click="doLater()">
                {{ t("service.prepareConfirmLater") }}
            </a-button>
            <a-button type="primary" :loading="starting" @click="doStart()">
                {{ t("service.prepareConfirmStart") }}
            </a-button>
        </template>
    </a-modal>
</template>
