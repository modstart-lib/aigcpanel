<script setup lang="ts">
import { computed } from "vue";
import { t } from "../../lang";

interface Props {
    status: string | undefined;
    statusMsg: string | undefined;
}

const props = defineProps<Props>();

const statusColor = computed(() => {
    const colorMap = {
        queue: "bg-gray-400",
        wait: "bg-gray-400",
        running: "bg-yellow-500",
        success: "bg-green-500",
        fail: "bg-red-500",
        pause: "bg-blue-500",
    };
    return colorMap[props.status as string] || "bg-gray-400";
});

const statusText = computed(() => {
    const textMap = {
        queue: t("status.queuing"),
        wait: t("status.waiting"),
        running: t("status.running"),
        success: t("common.success"),
        fail: t("common.failed"),
        pause: t("common.pause"),
    };
    return textMap[props.status as string] || "Unknown";
});
</script>

<template>
    <div class="text-white px-2 py-1 rounded-full text-sm inline-flex items-center" :class="statusColor">
        <div class="w-2 h-2 rounded-full bg-white mr-2"></div>
        <a-tooltip v-if="!!statusMsg && statusMsg.length < 20" :content="statusMsg" position="left" mini>
            <div>
                {{ statusText }}
                <icon-info-circle />
            </div>
        </a-tooltip>
        <a-popover v-else-if="!!statusMsg" position="left">
            <div>
                {{ statusText }}
                <icon-info-circle />
            </div>
            <template #content>
                <div class="w-96 h-32 overflow-auto -m-3">
                    <pre class="text-xs">{{ statusMsg }}</pre>
                </div>
            </template>
        </a-popover>
        <div v-else>{{ statusText }}</div>
    </div>
</template>
