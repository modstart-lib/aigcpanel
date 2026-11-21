<script setup lang="ts">
import { computed } from "vue";
import { t } from "../../lang";
import { ServerRecord } from "../../types/Server";

const props = defineProps<{
    record: ServerRecord;
}>();

const prepareConfig = computed(() => props.record.config?.prepare || null);
const runtime = computed(() => props.record.runtime);

// 仅对配置了 prepare 的模型展示；prepareReady 未同步前不展示，避免闪烁
const visible = computed(() => {
    return (
        !!prepareConfig.value &&
        typeof runtime.value?.prepareReady === "boolean" &&
        props.record.status !== undefined
    );
});

const ready = computed(() => runtime.value?.prepareReady === true);
const phase = computed(() => runtime.value?.prepare?.phase || "");
const percent = computed(() => {
    const value = runtime.value?.prepare?.percent;
    if (typeof value !== "number" || isNaN(value)) {
        return 0;
    }
    return Math.max(0, Math.min(100, Math.round(value)));
});

const formatSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) {
        return "";
    }
    const gb = bytes / 1024 ** 3;
    if (gb >= 1) {
        return `${gb.toFixed(1)} GB`;
    }
    return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
};

const sizeText = computed(() =>
    formatSize(
        runtime.value?.prepare?.totalSize || runtime.value?.prepareTotalSize,
    ),
);

const state = computed(() => {
    if (ready.value) {
        return "ready";
    }
    if (phase.value === "error") {
        return "error";
    }
    if (phase.value === "paused") {
        return "paused";
    }
    if (
        phase.value === "download" ||
        phase.value === "start" ||
        phase.value === "file" ||
        phase.value === "fileDone" ||
        phase.value === "resume" ||
        phase.value === "verify" ||
        phase.value === "localSource"
    ) {
        return "downloading";
    }
    return "pending";
});

const icon = computed(() => {
    switch (state.value) {
        case "ready":
            return "icon-check-circle";
        case "downloading":
            return "icon-sync";
        case "paused":
            return "icon-pause-circle";
        case "error":
            return "icon-alert-circle";
        default:
            return "icon-download";
    }
});

const text = computed(() => {
    switch (state.value) {
        case "ready":
            return t("status.weightsReady");
        case "downloading":
            return `${t("status.preparingWeights")} ${
                sizeText.value ? `${sizeText.value} · ` : ""
            }${percent.value}%`;
        case "paused":
            return `${t("status.pausedWeights")} ${percent.value}%`;
        case "error":
            return t("status.prepareFailed");
        default:
            return sizeText.value
                ? `${t("service.downloadWeights")}（${sizeText.value}）`
                : t("service.downloadWeights");
    }
});

const colorClass = computed(() => {
    switch (state.value) {
        case "ready":
            return "text-green-600";
        case "downloading":
        case "paused":
            return "text-amber-600";
        case "error":
            return "text-red-500";
        default:
            return "text-sky-600";
    }
});

// 悬停提示：失败原因 / 操作提示
const tip = computed(() => {
    if (state.value === "error") {
        return (
            runtime.value?.prepare?.error ||
            runtime.value?.prepareError ||
            t("status.prepareFailed")
        );
    }
    if (state.value === "paused") {
        return t("service.resumeDownload");
    }
    return "";
});
</script>

<template>
    <div
        v-if="visible"
        class="inline-flex items-center ml-1.5 mr-2 text-xs whitespace-nowrap"
        :class="colorClass"
        :title="tip"
    >
        <component
            :is="icon"
            class="mr-1 shrink-0"
            :class="{ 'animate-spin': state === 'downloading' }"
        />
        <span>{{ text }}</span>
        <span
            v-if="state === 'downloading'"
            class="ml-1.5 w-10 h-1 shrink-0 rounded-full bg-gray-200 overflow-hidden"
        >
            <span
                class="block h-full rounded-full bg-amber-500"
                :style="{ width: `${percent}%` }"
            ></span>
        </span>
    </div>
</template>
