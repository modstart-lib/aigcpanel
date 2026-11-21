<script setup lang="ts">
import { computed } from "vue";
import { t } from "../../../../lang";

const props = defineProps<{
    data: {
        targetFormat?: string;
        videoCodec?: string;
        audioCodec?: string;
        videoBitrate?: number;
        audioBitrate?: number;
        lossless?: boolean;
    };
}>();

const videoCodecMap = {
    libx264: "H.264",
    libx265: "H.265/HEVC",
    "libvpx-vp9": "VP9",
};

const audioCodecMap = {
    aac: "AAC",
    libmp3lame: "MP3",
    libopus: "Opus",
    pcm_s16le: "PCM",
    flac: "FLAC",
};

const videoCodecText = computed(() => {
    const codec = props.data.videoCodec;
    return videoCodecMap[codec as keyof typeof videoCodecMap] || codec;
});

const audioCodecText = computed(() => {
    const codec = props.data.audioCodec;
    return audioCodecMap[codec as keyof typeof audioCodecMap] || codec;
});
</script>

<template>
    <div class="flex flex-wrap mb-2 gap-1">
        <a-tag class="rounded-lg">{{
            t("app.formatValue", {
                value:
                    data.targetFormat?.toUpperCase() ||
                    t("common.notConfigured"),
            })
        }}</a-tag>
        <a-tag v-if="data.videoCodec && !data.lossless" class="rounded-lg">{{
            t("app.videoCodecValue", { value: videoCodecText })
        }}</a-tag>
        <a-tag v-if="data.videoBitrate && !data.lossless" class="rounded-lg">{{
            t("app.videoBitrateValue", { value: data.videoBitrate })
        }}</a-tag>
        <a-tag v-if="data.audioCodec && !data.lossless" class="rounded-lg">{{
            t("app.audioCodecValue", { value: audioCodecText })
        }}</a-tag>
        <a-tag v-if="data.audioBitrate && !data.lossless" class="rounded-lg">{{
            t("app.audioBitrateValue", { value: data.audioBitrate })
        }}</a-tag>
        <a-tag v-if="data.lossless !== undefined" class="rounded-lg">{{
            data.lossless ? t("app.losslessConvert") : t("app.lossyConvert")
        }}</a-tag>
    </div>
</template>
