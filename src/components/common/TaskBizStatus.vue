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

// Failures used to be hidden behind a tooltip on the status pill, so users only
// saw "failed" without the reason (e.g. the source video was moved away).
const statusMsgColor = computed(() => {
    if (props.status === "fail") {
        return "text-red-500";
    }
    if (props.status === "pause") {
        return "text-blue-500";
    }
    return "text-gray-500";
});
</script>

<template>
    <div class="inline-flex items-center gap-2 min-w-0">
        <a-tooltip
            v-if="!!statusMsg && statusMsg.length < 20"
            :content="statusMsg"
            position="left"
            mini
        >
            <div class="text-xs truncate max-w-[12rem]" :class="statusMsgColor">
                {{ statusMsg }}
            </div>
        </a-tooltip>
        <a-popover v-else-if="!!statusMsg" position="left">
            <div
                class="text-xs truncate max-w-[12rem] cursor-pointer"
                :class="statusMsgColor"
            >
                {{ statusMsg }}
            </div>
            <template #content>
                <div class="w-96 max-h-60 overflow-auto -m-3 p-3">
                    <pre class="text-xs whitespace-pre-wrap break-all">{{
                        statusMsg
                    }}</pre>
                </div>
            </template>
        </a-popover>
        <div
            class="text-white px-2 py-1 rounded-full text-sm inline-flex items-center flex-shrink-0"
            :class="statusColor"
        >
            <div class="w-2 h-2 rounded-full bg-white mr-2"></div>
            {{ statusText }}
        </div>
    </div>
</template>
