<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { t } from "../../../../lang";
import { Dialog } from "../../../../lib/dialog";

const formData = ref({
    targetWidth: 1920,
    targetHeight: 1080,
    fillMode: "black" as "blur" | "black" | "crop" | "stretch",
});

type VideoSizeConvertForm = {
    targetWidth: number;
    targetHeight: number;
    fillMode: "blur" | "black" | "crop" | "stretch";
};

const presetPortrait = computed(() => t("app.presetPortrait"));
const presetSquare = computed(() => t("app.presetSquare"));

const sizePresets = computed(() => [
    { key: "4k", label: "4K (3840x2160)", width: 3840, height: 2160 },
    {
        key: "4k-portrait",
        label: `4K${presetPortrait.value} (2160x3840)`,
        width: 2160,
        height: 3840,
    },
    { key: "1440p", label: "1440P (2560x1440)", width: 2560, height: 1440 },
    {
        key: "1440p-portrait",
        label: `1440P${presetPortrait.value} (1440x2560)`,
        width: 1440,
        height: 2560,
    },
    { key: "1080p", label: "1080P (1920x1080)", width: 1920, height: 1080 },
    {
        key: "1080p-portrait",
        label: `1080P${presetPortrait.value} (1080x1920)`,
        width: 1080,
        height: 1920,
    },
    { key: "720p", label: "720P (1280x720)", width: 1280, height: 720 },
    {
        key: "720p-portrait",
        label: `720P${presetPortrait.value} (720x1280)`,
        width: 720,
        height: 1280,
    },
    { key: "480p", label: "480P (854x480)", width: 854, height: 480 },
    {
        key: "480p-portrait",
        label: `480P${presetPortrait.value} (480x854)`,
        width: 480,
        height: 854,
    },
    {
        key: "square-1080",
        label: `${presetSquare.value}1080 (1080x1080)`,
        width: 1080,
        height: 1080,
    },
    {
        key: "square-720",
        label: `${presetSquare.value}720 (720x720)`,
        width: 720,
        height: 720,
    },
    {
        key: "square-480",
        label: `${presetSquare.value}480 (480x480)`,
        width: 480,
        height: 480,
    },
]);

const selectedPreset = ref<string>("");

const updatePreset = () => {
    const preset = sizePresets.value.find(
        (p) =>
            p.width === formData.value.targetWidth &&
            p.height === formData.value.targetHeight,
    );
    selectedPreset.value = preset ? preset.key : "";
};

const onPresetChange = (value: string) => {
    const preset = sizePresets.value.find((p) => p.key === value);
    if (preset) {
        formData.value.targetWidth = preset.width;
        formData.value.targetHeight = preset.height;
    }
};

onMounted(() => {
    updatePreset();
});
const getValue = async (): Promise<VideoSizeConvertForm | undefined> => {
    const data: any = {};
    data.targetWidth = formData.value.targetWidth;
    data.targetHeight = formData.value.targetHeight;
    data.fillMode = formData.value.fillMode;
    if (data.targetWidth <= 0 || isNaN(data.targetWidth)) {
        Dialog.tipError(t("error.validTargetWidth"));
        return;
    }
    if (data.targetHeight <= 0 || isNaN(data.targetHeight)) {
        Dialog.tipError(t("error.validTargetHeight"));
        return;
    }
    return data;
};

const setValue = (data: Partial<VideoSizeConvertForm>) => {
    if (data.targetWidth !== undefined) {
        formData.value.targetWidth = data.targetWidth;
    }
    if (data.targetHeight !== undefined) {
        formData.value.targetHeight = data.targetHeight;
    }
    if (data.fillMode !== undefined) {
        formData.value.fillMode = data.fillMode;
    }
    updatePreset();
};

defineExpose({
    getValue,
    setValue,
});
</script>

<template>
    <div class="mb-4 flex items-start">
        <div class="pt-1 w-5">
            <a-tooltip :content="$t('common.targetSize')" mini>
                <icon-expand />
            </a-tooltip>
        </div>
        <div class="flex items-center gap-2">
            <a-input-number
                v-model="formData.targetWidth"
                :min="1"
                :max="4096"
                :step="1"
                :placeholder="$t('common.width')"
                style="width: 100px"
                @change="updatePreset"
            />
            <span>x</span>
            <a-input-number
                v-model="formData.targetHeight"
                :min="1"
                :max="4096"
                :step="1"
                :placeholder="$t('common.height')"
                style="width: 100px"
                @change="updatePreset"
            />
            <a-select
                v-model="selectedPreset"
                :placeholder="$t('common.selectPreset')"
                style="width: 200px"
                @change="onPresetChange"
            >
                <a-option
                    v-for="preset in sizePresets"
                    :key="preset.key"
                    :value="preset.key"
                >
                    {{ preset.label }}
                </a-option>
            </a-select>
        </div>
    </div>
    <div class="mb-4 flex items-start">
        <div class="pt-1 w-5">
            <a-tooltip :content="$t('common.fillMode')" mini>
                <icon-image />
            </a-tooltip>
        </div>
        <div class="flex items-center gap-2">
            <a-radio-group v-model="formData.fillMode">
                <a-radio value="black">{{ $t("common.blackFill") }}</a-radio>
                <a-radio value="blur">{{ $t("common.blurFill") }}</a-radio>
                <a-radio value="crop">{{ $t("common.cropFill") }}</a-radio>
                <a-radio value="stretch">{{
                    $t("common.stretchFill")
                }}</a-radio>
            </a-radio-group>
        </div>
    </div>
</template>
