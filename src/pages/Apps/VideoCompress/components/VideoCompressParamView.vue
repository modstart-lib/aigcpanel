<script setup lang="ts">
import { t } from "../../../../lang";
const props = defineProps<{
    data: {
        codec?: string;
        resolution?: string;
        compressionLevel?: number;
    };
}>();
</script>

<template>
    <div class="flex flex-wrap mb-2 gap-1">
        <a-tag v-if="data.codec" class="rounded-lg">{{
            t("app.codecValue", { value: data.codec })
        }}</a-tag>
        <a-tag v-if="data.resolution" class="rounded-lg">{{
            t("app.resolutionValue", { value: data.resolution })
        }}</a-tag>
        <a-tag v-if="data.compressionLevel !== undefined" class="rounded-lg">{{
            t("app.compressionLevelValue", { value: data.compressionLevel })
        }}</a-tag>
        <a-tag
            v-if="
                !data.codec &&
                !data.resolution &&
                data.compressionLevel === undefined
            "
            class="rounded-lg"
        >
            {{ t("common.notConfigured") }}
        </a-tag>
    </div>
</template>
