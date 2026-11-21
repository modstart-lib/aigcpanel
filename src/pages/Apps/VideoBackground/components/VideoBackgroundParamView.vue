<script setup lang="ts">
import { t } from "../../../../lang";
interface Props {
    value: {
        imageMode: "cover" | "contain";
        videoX: number;
        videoY: number;
        videoWidth: number;
        videoHeight: number;
        outputWidth: number;
        outputHeight: number;
        videoBorderWidth: number;
        videoBorderColor: string;
        videoBorderOpacity: number;
        videoBorderRadius: number;
    };
}

const props = defineProps<Props>();
</script>

<template>
    <div class="flex flex-wrap mb-2 gap-1">
        <a-tag class="rounded-lg"
            >{{ t("app.imageModeValue") }}
            {{
                props.value.imageMode === "cover"
                    ? t("app.modeCover")
                    : t("app.modeContain")
            }}
        </a-tag>
        <a-tag class="rounded-lg">{{
            t("app.videoPositionValue", {
                x: props.value.videoX,
                y: props.value.videoY,
            })
        }}</a-tag>
        <a-tag class="rounded-lg">{{
            t("app.videoSizeValue", {
                x: props.value.videoWidth,
                y: props.value.videoHeight,
            })
        }}</a-tag>
        <a-tag class="rounded-lg">{{
            t("app.imageSizeValue", {
                x: props.value.outputWidth,
                y: props.value.outputHeight,
            })
        }}</a-tag>
        <a-tag class="rounded-lg">{{
            t("app.borderWidthValue", { value: props.value.videoBorderWidth })
        }}</a-tag>
        <a-tag class="rounded-lg">{{
            t("app.borderColorValue", { value: props.value.videoBorderColor })
        }}</a-tag>
        <a-tag class="rounded-lg">{{
            t("app.borderOpacityValue", {
                value: props.value.videoBorderOpacity,
            })
        }}</a-tag>
        <a-tag class="rounded-lg">{{
            t("app.borderRadiusValue", { value: props.value.videoBorderRadius })
        }}</a-tag>
    </div>
</template>
