<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { t } from "../../lang";
import { formatPrepareBytes } from "../../lib/prepareDownload";
import { useServerStore } from "../../store/modules/server";

// 权重按需下载：把「还没开始下」的模型汇总成一条，
// 让用户在任何时候都能看到要下多少、点一下全部开始。
const serverStore = useServerStore();

const idleRecords = computed(() => serverStore.idlePrepareRecords());
const visible = computed(() => idleRecords.value.length > 0);
const bytes = computed(() =>
    serverStore.pendingPrepareBytes(idleRecords.value),
);
const sizeText = computed(() => formatPrepareBytes(bytes.value));

const summary = ref({
    diskCount: 0,
    freeMin: null as number | null,
    shortfall: 0,
});
const freeText = computed(() => formatPrepareBytes(summary.value.freeMin));
const spaceShort = computed(() => summary.value.shortfall > 0);
const alertType = computed(() => (spaceShort.value ? "warning" : "info"));

const refreshSummary = async () => {
    if (!visible.value) {
        summary.value = { diskCount: 0, freeMin: null, shortfall: 0 };
        return;
    }
    summary.value = await serverStore.prepareDiskSummary(idleRecords.value);
};

const starting = ref(false);
const doDownloadAll = async () => {
    if (starting.value) {
        return;
    }
    starting.value = true;
    try {
        await serverStore.startPendingPrepare();
    } finally {
        starting.value = false;
        await refreshSummary();
    }
};

onMounted(() => {
    refreshSummary().then();
});

watch(
    () => idleRecords.value.map((record) => record.key).join(","),
    () => {
        refreshSummary().then();
    },
);
</script>

<template>
    <a-alert v-if="visible" class="mb-4" :type="alertType" show-icon>
        <template #title>
            {{ t("status.weightsPendingTitle") }}
        </template>
        <div class="flex flex-wrap items-center gap-2">
            <div class="flex-grow min-w-0">
                {{
                    t("status.weightsPendingSummary", {
                        count: idleRecords.length,
                        size: sizeText,
                    })
                }}
                <span v-if="freeText" class="text-gray-500">
                    ·
                    {{
                        summary.diskCount > 1
                            ? t("status.diskFreeMulti", { size: freeText })
                            : t("status.diskFree", { size: freeText })
                    }}
                </span>
                <span v-if="spaceShort" class="text-red-500 ml-1">
                    · {{ t("status.diskNotEnough") }}
                </span>
            </div>
            <a-button
                type="primary"
                :loading="starting"
                @click="doDownloadAll()"
            >
                {{ t("service.downloadAll") }}
            </a-button>
        </div>
    </a-alert>
</template>
