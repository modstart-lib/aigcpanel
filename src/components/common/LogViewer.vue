<script setup lang="ts">
import {nextTick, ref, watch} from "vue";

const logContainer = ref<HTMLElement | null>(null);

interface LogItem {
    num: number;
    text: string;
}

const props = withDefaults(
    defineProps<{
        logs: LogItem[];
        autoScroll?: boolean;
        height?: string;
    }>(),
    {
        logs: [] as any,
        autoScroll: true,
        height: "100%",
    }
);

const scrollToBottom = () => {
    nextTick(() => {
        logContainer.value?.scrollTo({
            top: logContainer.value?.scrollHeight,
            behavior: "smooth",
        });
    });
};

watch(
    () => {
        return props.logs;
    },
    () => {
        if (props.autoScroll) {
            scrollToBottom();
        }
    },
    {
        immediate: true,
        deep: true,
    }
);

watch(
    () => {
        return props.autoScroll;
    },
    () => {
        if (props.autoScroll) {
            scrollToBottom();
        }
    }
);
</script>

<template>
    <div :style="{height: props.height}" ref="logContainer" class="bg-black p-3 overflow-auto">
        <div v-if="!logs.length" class="text-center text-white py-10">
            <div>
                <i class="iconfont icon-empty-box text-4xl"></i>
            </div>
            <div class="text-xs mt-3">
                {{ $t("empty.noLog") }}
            </div>
        </div>
        <div v-for="log in logs" class="text-white text-sm font-mono leading-6 whitespace-nowrap">
            <div class="inline-block text-right min-w-10 pr-3 text-gray-400">{{ log.num }}</div>
            <div class="inline-block">{{ log.text }}</div>
        </div>
    </div>
</template>

<style scoped></style>
