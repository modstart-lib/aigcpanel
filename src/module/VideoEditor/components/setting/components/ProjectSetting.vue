<template>
    <div class="p-4">
        <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-bold">
                {{ $t("videoEditor.videoSettings") }}
            </h3>
            <a-button
                type="primary"
                @click="onApplySettings"
                :loading="applying"
                :disabled="!hasChanges"
                size="small"
            >
                {{ $t("videoEditor.applySettings") }}
            </a-button>
        </div>

        <div class="space-y-4">
            <!-- 自定义尺寸 -->
            <div>
                <div class="text-sm font-medium mb-2">
                    {{ $t("videoEditor.customSize") }}
                </div>
                <div class="flex items-center space-x-2">
                    <a-input-number
                        v-model="customWidth"
                        :min="1"
                        :max="4096"
                        :step="1"
                        placeholder="宽度"
                        size="small"
                        class="flex-1"
                        @change="onCustomSizeChange"
                    />
                    <span class="text-gray-500">×</span>
                    <a-input-number
                        v-model="customHeight"
                        :min="1"
                        :max="4096"
                        :step="1"
                        placeholder="高度"
                        size="small"
                        class="flex-1"
                        @change="onCustomSizeChange"
                    />
                    <div>
                        <a-button @click="onSwapDimensions">
                            <template #icon>
                                <icon-swap />
                            </template>
                        </a-button>
                    </div>
                </div>
                <div class="mt-2">
                    <a-select
                        v-model="selectedPreset"
                        @change="onPresetChange"
                        class="w-full"
                        size="small"
                        placeholder="选择预设尺寸"
                        :options="presetOptions"
                    />
                </div>
            </div>

            <!-- 帧率设置 -->
            <div>
                <div class="text-sm font-medium mb-2">
                    {{ $t("videoEditor.frameRate") }}
                </div>
                <a-select
                    v-model="customFrameRate"
                    class="w-full"
                    size="small"
                    :options="frameRateOptions"
                />
                <div class="text-xs text-gray-500 mt-1">
                    {{ $t("videoEditor.frameRateHint") }}
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Dialog } from "../../../../../lib/dialog";
import { usePlayerStore } from "../../../stores/player";
import { VIDEO_PREVIEW_FIXED_FPS } from "../../../core/config";

const playerStore = usePlayerStore();

// initial value
const initialWidth = ref(1920);
const initialHeight = ref(1080);
const initialFrameRate = ref(VIDEO_PREVIEW_FIXED_FPS);

// new value
const customWidth = ref(1920);
const customHeight = ref(1080);
const customFrameRate = ref(VIDEO_PREVIEW_FIXED_FPS);

// presets
const presets = [
    { name: "1080P", width: 1920, height: 1080 },
    { name: "720P", width: 1280, height: 720 },
    { name: "4K", width: 3840, height: 2160 },
    { name: "竖屏HD", width: 1080, height: 1920 },
    { name: "正方形", width: 1080, height: 1080 },
    { name: "16:10", width: 1920, height: 1200 },
];
const presetOptions = computed(() =>
    presets.map((preset) => ({
        label: `${preset.name} (${preset.width}×${preset.height})`,
        value: preset.name,
    })),
);
const selectedPreset = ref("1080P");
const applying = ref(false);
const frameRateOptions = [
    { label: "24 FPS", value: 24 },
    { label: "25 FPS", value: 25 },
    { label: "30 FPS", value: 30 },
    { label: "60 FPS", value: 60 },
];

// 计算是否有变化
const hasChanges = computed(() => {
    return (
        customWidth.value !== initialWidth.value ||
        customHeight.value !== initialHeight.value ||
        customFrameRate.value !== initialFrameRate.value
    );
});

// 初始化当前设置
onMounted(() => {
    initialWidth.value = playerStore.playerWidth;
    initialHeight.value = playerStore.playerHeight;
    initialFrameRate.value = playerStore.frameRate;

    customWidth.value = initialWidth.value;
    customHeight.value = initialHeight.value;
    customFrameRate.value = initialFrameRate.value;

    // 检查是否匹配预设
    onCustomSizeChange();
});

const onPresetChange = () => {
    const preset = presets.find((p) => p.name === selectedPreset.value);
    if (preset) {
        customWidth.value = preset.width;
        customHeight.value = preset.height;
    }
};

// 自定义尺寸改变
const onCustomSizeChange = () => {
    selectedPreset.value = "";
    const matchedPreset = presets.find(
        (preset) =>
            preset.width === customWidth.value &&
            preset.height === customHeight.value,
    );
    if (matchedPreset) {
        selectedPreset.value = matchedPreset.name;
    }
};
const onSwapDimensions = () => {
    const temp = customWidth.value;
    customWidth.value = customHeight.value;
    customHeight.value = temp;
    onCustomSizeChange();
};

const onApplySettings = async () => {
    if (customWidth.value <= 0 || customHeight.value <= 0) {
        Dialog.tipError("请输入有效的尺寸");
        return;
    }
    applying.value = true;
    playerStore.playerWidth = customWidth.value;
    playerStore.playerHeight = customHeight.value;
    playerStore.frameRate = customFrameRate.value;
    initialWidth.value = customWidth.value;
    initialHeight.value = customHeight.value;
    initialFrameRate.value = customFrameRate.value;
    Dialog.tipSuccess("设置已生效");
    applying.value = false;
};
</script>
