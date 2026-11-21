<script setup lang="ts">
import { onMounted, ref } from "vue";
import { t } from "../../../../lang";
import { Dialog } from "../../../../lib/dialog";

const formData = ref({
    targetFormat: "mp4",
    videoCodec: "libx264",
    audioCodec: "aac",
    videoBitrate: 2000,
    audioBitrate: 128,
    lossless: false,
});

type MediaFormatConvertForm = {
    targetFormat: string;
    videoCodec: string;
    audioCodec: string;
    videoBitrate: number;
    audioBitrate: number;
    lossless: boolean;
};

const formatOptions = [
    {
        key: "mp4-h264",
        name: "MP4 (H.264)",
        kind: "video",
        format: "mp4",
        videoCodec: "libx264",
        audioCodec: "aac",
    },
    {
        key: "mp4-h265",
        name: "MP4 (H.265/HEVC)",
        kind: "video",
        format: "mp4",
        videoCodec: "libx265",
        audioCodec: "aac",
    },
    {
        key: "webm-vp9",
        name: "WebM (VP9)",
        kind: "video",
        format: "webm",
        videoCodec: "libvpx-vp9",
        audioCodec: "libopus",
    },
    {
        key: "mkv-h264",
        name: "MKV (H.264)",
        kind: "video",
        format: "mkv",
        videoCodec: "libx264",
        audioCodec: "aac",
    },
    {
        key: "mp3",
        name: "MP3",
        kind: "audio",
        format: "mp3",
        videoCodec: "",
        audioCodec: "libmp3lame",
    },
    {
        key: "aac",
        name: "AAC",
        kind: "audio",
        format: "aac",
        videoCodec: "",
        audioCodec: "aac",
    },
    {
        key: "wav",
        name: "WAV",
        kind: "audio",
        format: "wav",
        videoCodec: "",
        audioCodec: "pcm_s16le",
    },
    {
        key: "flac",
        name: "FLAC",
        kind: "audio",
        format: "flac",
        videoCodec: "",
        audioCodec: "flac",
    },
];

const selectedFormat = ref<string>(formatOptions[0].key);

const formatLabel = (option: (typeof formatOptions)[0]) =>
    option.kind === "audio"
        ? `${option.name} (${t("app.audio")})`
        : option.name;

const updateFormat = () => {
    const format = formatOptions.find(
        (f) =>
            f.format === formData.value.targetFormat &&
            f.videoCodec === formData.value.videoCodec &&
            f.audioCodec === formData.value.audioCodec,
    );
    selectedFormat.value = format ? format.key : "";
};

const onFormatChange = (value: string) => {
    const format = formatOptions.find((f) => f.key === value);
    if (format) {
        formData.value.targetFormat = format.format;
        if (!formData.value.lossless) {
            formData.value.videoCodec = format.videoCodec;
            formData.value.audioCodec = format.audioCodec;
        }
    }
};

onMounted(() => {
    updateFormat();
});

const getValue = async (): Promise<MediaFormatConvertForm | undefined> => {
    const data: any = {};
    data.targetFormat = formData.value.targetFormat;
    data.videoCodec = formData.value.videoCodec;
    data.audioCodec = formData.value.audioCodec;
    data.videoBitrate = formData.value.videoBitrate;
    data.audioBitrate = formData.value.audioBitrate;
    data.lossless = formData.value.lossless;

    if (!data.targetFormat) {
        Dialog.tipError(t("error.selectTargetFormat"));
        return;
    }
    if (!data.lossless) {
        if (data.videoBitrate < 0 || isNaN(data.videoBitrate)) {
            Dialog.tipError(t("error.validVideoBitrate"));
            return;
        }
        if (data.audioBitrate < 0 || isNaN(data.audioBitrate)) {
            Dialog.tipError(t("error.validAudioBitrate"));
            return;
        }
    }
    return data;
};

const setValue = (data: Partial<MediaFormatConvertForm>) => {
    if (data.targetFormat !== undefined) {
        formData.value.targetFormat = data.targetFormat;
    }
    if (data.videoCodec !== undefined) {
        formData.value.videoCodec = data.videoCodec;
    }
    if (data.audioCodec !== undefined) {
        formData.value.audioCodec = data.audioCodec;
    }
    if (data.videoBitrate !== undefined) {
        formData.value.videoBitrate = data.videoBitrate;
    }
    if (data.audioBitrate !== undefined) {
        formData.value.audioBitrate = data.audioBitrate;
    }
    if (data.lossless !== undefined) {
        formData.value.lossless = data.lossless;
    }
    updateFormat();
};

defineExpose({
    getValue,
    setValue,
});
</script>

<template>
    <div class="flex items-start mb-3">
        <div class="pt-1 w-5">
            <a-tooltip :content="t('app.targetFormat')" mini>
                <icon-file />
            </a-tooltip>
        </div>
        <div class="flex items-center gap-2">
            <a-select
                v-model="selectedFormat"
                :placeholder="t('app.selectTargetFormat')"
                style="width: 200px"
                @change="onFormatChange"
            >
                <a-option
                    v-for="format in formatOptions"
                    :key="format.key"
                    :value="format.key"
                >
                    {{ formatLabel(format) }}
                </a-option>
            </a-select>
        </div>
    </div>
    <div class="mb-4 flex items-start">
        <div class="pt-1 w-5">
            <a-tooltip :content="t('app.losslessConvert')" mini>
                <icon-check-circle />
            </a-tooltip>
        </div>
        <div class="flex items-center gap-2">
            <a-checkbox v-model="formData.lossless">
                {{ t("app.losslessConvert") }}
            </a-checkbox>
        </div>
    </div>
    <div v-if="!formData.lossless" class="mb-4 flex items-start">
        <div class="pt-1 w-5">
            <a-tooltip :content="t('app.videoBitrate')" mini>
                <icon-video-camera />
            </a-tooltip>
        </div>
        <div class="flex items-center gap-2">
            <a-input-number
                v-model="formData.videoBitrate"
                :min="0"
                :max="20000"
                :step="100"
                :placeholder="t('app.videoBitratePlaceholder')"
                style="width: 200px"
                :disabled="formData.lossless"
            />
            <span>kbps</span>
        </div>
    </div>
    <div v-if="!formData.lossless" class="mb-4 flex items-start">
        <div class="pt-1 w-5">
            <a-tooltip :content="t('app.audioBitrate')" mini>
                <icon-file />
            </a-tooltip>
        </div>
        <div class="flex items-center gap-2">
            <a-input-number
                v-model="formData.audioBitrate"
                :min="0"
                :max="320"
                :step="16"
                :placeholder="t('app.audioBitratePlaceholder')"
                style="width: 200px"
                :disabled="formData.lossless"
            />
            <span>kbps</span>
        </div>
    </div>
</template>
