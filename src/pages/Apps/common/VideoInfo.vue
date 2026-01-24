<script setup lang="ts">
import { t } from "../../../lang";
import { TimeUtil } from "../../../lib/util";


const props = withDefaults(
    defineProps<{
        label?: boolean;
        icon?: boolean;
        data?: {
            videoWidth?: number;
            videoHeight?: number;
            videoDuration?: number;
            videoFps?: number;
            width?: number;
            height?: number;
            duration?: number;
            fps?: number;
        };
    }>(),
    {
        icon: true,
        label: true,
        data: () => ({}),
    }
);
</script>

<template>
    <a-tag v-if="icon" class="rounded-lg" color="blue">
        <icon-file-video />
    </a-tag>
    <a-tag class="rounded-lg"
        >{{ label ? t("common.resolution") : "" }}{{ data?.width || data?.videoWidth || "?" }}x{{
            data?.height || data?.videoHeight || "?"
        }}
    </a-tag>
    <a-tag class="rounded-lg">
        {{ label ? t("common.duration") : "" }}{{ TimeUtil.secondsToTime(data?.duration || data?.videoDuration || 0) }}
    </a-tag>
    <a-tag class="rounded-lg">{{ (data?.fps || data?.videoFps || 0).toFixed(2) }} FPS</a-tag>
</template>

<style scoped></style>
