<script setup lang="ts">
import { computed } from "vue";
import { t } from "../../../../lang";

interface Props {
    value: {
        imageMode?: "cover" | "contain";
        keyColor?: string;
        similarity?: number;
        blend?: number;
        outputWidth?: number;
        outputHeight?: number;
    };
}

const props = defineProps<Props>();

const imageModeText = computed(() => {
    return props.value?.imageMode === "contain"
        ? t("app.vbrModeContain")
        : t("app.vbrModeCover");
});

const outputSizeText = computed(() => {
    const width = props.value?.outputWidth;
    const height = props.value?.outputHeight;
    if (width && height) {
        return `${width}x${height}`;
    }
    return t("app.vbrOutputSizeAuto");
});
</script>

<template>
    <div class="flex flex-wrap mb-2 gap-1">
        <a-tag class="rounded-lg">{{ imageModeText }}</a-tag>
        <a-tag class="rounded-lg">
            <span
                class="inline-block w-3 h-3 rounded-sm mr-1 align-middle border border-gray-300"
                :style="{ background: props.value?.keyColor || '#00FF00' }"
            />
            {{ props.value?.keyColor || "#00FF00" }}
        </a-tag>
        <a-tag class="rounded-lg"
            >{{ t("app.vbrSimilarity") }}
            {{ props.value?.similarity ?? 0.3 }}</a-tag
        >
        <a-tag class="rounded-lg"
            >{{ t("app.vbrBlend") }} {{ props.value?.blend ?? 0.1 }}</a-tag
        >
        <a-tag class="rounded-lg">{{ outputSizeText }}</a-tag>
    </div>
</template>
