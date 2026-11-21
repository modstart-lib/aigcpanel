<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { t } from "../../../../lang";
import { FileUtil } from "../../../../lib/file";
import { applyChromaKey } from "../chroma-key";

const props = defineProps<{
    video?: string;
    backgroundImage?: string;
}>();

const formData = ref({
    imageMode: "cover" as "cover" | "contain",
    keyColor: "#00FF00",
    similarity: 0.3,
    blend: 0.1,
    autoSize: true,
    outputWidth: 1920,
    outputHeight: 1080,
});

type VideoBackgroundReplaceForm = {
    imageMode: "cover" | "contain";
    keyColor: string;
    similarity: number;
    blend: number;
    outputWidth: number;
    outputHeight: number;
};

const presetPortrait = computed(() => t("app.presetPortrait"));
const presetSquare = computed(() => t("app.presetSquare"));

const sizePresets = computed(() => [
    { label: "4K (3840x2160)", value: "3840x2160" },
    { label: `4K${presetPortrait.value} (2160x3840)`, value: "2160x3840" },
    { label: "1440P (2560x1440)", value: "2560x1440" },
    { label: `1440P${presetPortrait.value} (1440x2560)`, value: "1440x2560" },
    { label: "1080P (1920x1080)", value: "1920x1080" },
    { label: `1080P${presetPortrait.value} (1080x1920)`, value: "1080x1920" },
    { label: "720P (1280x720)", value: "1280x720" },
    { label: `720P${presetPortrait.value} (720x1280)`, value: "720x1280" },
    { label: "480P (854x480)", value: "854x480" },
    { label: `480P${presetPortrait.value} (480x854)`, value: "480x854" },
    { label: `${presetSquare.value}1080 (1080x1080)`, value: "1080x1080" },
    { label: `${presetSquare.value}720 (720x720)`, value: "720x720" },
]);

const sizePreset = ref("1920x1080");

const modeOptions = computed(() => [
    { label: t("app.vbrModeCover"), value: "cover" },
    { label: t("app.vbrModeContain"), value: "contain" },
]);

const canvasRef = ref<HTMLCanvasElement | null>(null);
const playing = ref(false);
const videoReady = ref(false);
const hasVideo = computed(() => !!props.video);
const hasImage = computed(() => !!props.backgroundImage);

// 预览画布尺寸（按输出比例自适应，最长边 360）
const previewSize = computed(() => {
    const maxSize = 360;
    const aspectRatio =
        formData.value.outputWidth / formData.value.outputHeight;
    if (!isFinite(aspectRatio) || aspectRatio <= 0) {
        return { width: maxSize, height: maxSize };
    }
    if (aspectRatio >= 1) {
        return { width: maxSize, height: Math.round(maxSize / aspectRatio) };
    }
    return { width: Math.round(maxSize * aspectRatio), height: maxSize };
});

let videoEl: HTMLVideoElement | null = null;
let bgImageEl: HTMLImageElement | null = null;
let workCanvas: HTMLCanvasElement | null = null;
let workCtx: CanvasRenderingContext2D | null = null;
let videoUrl = "";
let bgUrl = "";
let animId = 0;
let renderPending = false;

const revokeUrl = (url: string) => {
    if (url) {
        URL.revokeObjectURL(url);
    }
};

const streamToBlobUrl = async (path: string, type: string) => {
    const stream = await $mapi.file.readStream(path);
    if (!stream) {
        throw new Error("read stream failed");
    }
    const blob = await new Response(stream, {
        headers: { "Content-Type": type || "application/octet-stream" },
    }).blob();
    return URL.createObjectURL(blob);
};

const fileType = (path: string, fallback: string) => {
    return FileUtil.extensionToType(FileUtil.getExt(path)) || fallback;
};

const loadVideo = async (path: string) => {
    revokeUrl(videoUrl);
    videoUrl = "";
    playing.value = false;
    videoReady.value = false;
    if (!path) {
        if (videoEl) {
            videoEl.pause();
            videoEl.removeAttribute("src");
        }
        scheduleRender();
        return;
    }
    try {
        videoUrl = await streamToBlobUrl(path, fileType(path, "video/mp4"));
        if (!videoEl) {
            videoEl = document.createElement("video");
            videoEl.muted = true;
            videoEl.loop = true;
            videoEl.playsInline = true;
        }
        videoEl.preload = "auto";
        videoEl.onloadedmetadata = () => {
            videoReady.value = true;
            if (formData.value.autoSize && videoEl) {
                formData.value.outputWidth = videoEl.videoWidth;
                formData.value.outputHeight = videoEl.videoHeight;
            }
            scheduleRender();
        };
        // 首帧解码完成后再重绘，保证暂停状态下也能看到画面
        videoEl.onloadeddata = () => {
            scheduleRender();
        };
        videoEl.oncanplay = () => {
            scheduleRender();
        };
        videoEl.src = videoUrl;
        videoEl.load();
    } catch (e) {
        console.error("Failed to load green screen video:", e);
    }
};

const loadBackgroundImage = async (path: string) => {
    revokeUrl(bgUrl);
    bgUrl = "";
    bgImageEl = null;
    if (!path) {
        scheduleRender();
        return;
    }
    try {
        bgUrl = await streamToBlobUrl(path, fileType(path, "image/png"));
        const img = new Image();
        img.onload = () => {
            bgImageEl = img;
            scheduleRender();
        };
        img.onerror = () => {
            console.error("Failed to load background image");
        };
        img.src = bgUrl;
    } catch (e) {
        console.error("Failed to load background image:", e);
    }
};

// 与最终渲染共用同一套抠像算法（chroma-key.ts），保证预览所见即所得
const processVideoFrame = (): HTMLCanvasElement | null => {
    if (!videoEl || !videoReady.value || videoEl.videoWidth < 1) {
        return null;
    }
    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    const maxW = 480;
    const scaleDown = Math.min(1, maxW / vw);
    const w = Math.max(1, Math.round(vw * scaleDown));
    const h = Math.max(1, Math.round(vh * scaleDown));
    if (!workCanvas) {
        workCanvas = document.createElement("canvas");
        workCtx = workCanvas.getContext("2d", { willReadFrequently: true });
    }
    workCanvas.width = w;
    workCanvas.height = h;
    if (!workCtx) {
        return null;
    }
    workCtx.clearRect(0, 0, w, h);
    workCtx.drawImage(videoEl, 0, 0, w, h);
    const imageData = workCtx.getImageData(0, 0, w, h);
    applyChromaKey(imageData.data, {
        keyColor: formData.value.keyColor,
        similarity: formData.value.similarity,
        blend: formData.value.blend,
    });
    workCtx.putImageData(imageData, 0, 0);
    return workCanvas;
};

const drawImageByMode = (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    width: number,
    height: number,
    mode: "cover" | "contain",
) => {
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    if (iw < 1 || ih < 1) {
        return;
    }
    const ratio =
        mode === "contain"
            ? Math.min(width / iw, height / ih)
            : Math.max(width / iw, height / ih);
    const dw = iw * ratio;
    const dh = ih * ratio;
    ctx.drawImage(img, (width - dw) / 2, (height - dh) / 2, dw, dh);
};

const renderFrame = () => {
    const cvs = canvasRef.value;
    if (!cvs) {
        return;
    }
    const size = previewSize.value;
    if (cvs.width !== size.width || cvs.height !== size.height) {
        cvs.width = size.width;
        cvs.height = size.height;
    }
    const width = cvs.width;
    const height = cvs.height;
    const ctx = cvs.getContext("2d");
    if (!ctx) {
        return;
    }
    ctx.clearRect(0, 0, width, height);
    // 背景：有背景图时先铺黑底，与最终合成器的背景色一致（contain 模式会露出黑边）
    const hasBg = !!bgImageEl && bgImageEl.naturalWidth > 0;
    ctx.fillStyle = hasBg ? "#000000" : "#f3f4f6";
    ctx.fillRect(0, 0, width, height);
    if (hasBg && bgImageEl) {
        drawImageByMode(
            ctx,
            bgImageEl,
            width,
            height,
            formData.value.imageMode,
        );
    }
    // 前景（抠像后的绿幕视频帧，等比居中，与最终渲染几何一致）
    const frame = processVideoFrame();
    if (frame) {
        const ratio = Math.min(width / frame.width, height / frame.height);
        const dw = frame.width * ratio;
        const dh = frame.height * ratio;
        ctx.drawImage(frame, (width - dw) / 2, (height - dh) / 2, dw, dh);
    }
};

const loop = () => {
    renderFrame();
    if (playing.value) {
        animId = requestAnimationFrame(loop);
    }
};

const scheduleRender = () => {
    if (renderPending) {
        return;
    }
    renderPending = true;
    requestAnimationFrame(() => {
        renderPending = false;
        renderFrame();
    });
};

const togglePlay = async () => {
    if (!videoEl || !videoReady.value) {
        return;
    }
    if (playing.value) {
        videoEl.pause();
        playing.value = false;
        cancelAnimationFrame(animId);
        scheduleRender();
    } else {
        try {
            await videoEl.play();
            playing.value = true;
            loop();
        } catch (e) {
            console.error("Failed to play video:", e);
        }
    }
};

watch(
    () => props.video,
    (path) => {
        loadVideo(path || "");
    },
);

watch(
    () => props.backgroundImage,
    (path) => {
        loadBackgroundImage(path || "");
    },
);

watch(previewSize, () => {
    scheduleRender();
});

watch(
    formData,
    () => {
        scheduleRender();
    },
    { deep: true },
);

watch(
    [() => formData.value.outputWidth, () => formData.value.outputHeight],
    () => {
        if (formData.value.autoSize) {
            return;
        }
        const preset = `${formData.value.outputWidth}x${formData.value.outputHeight}`;
        if (sizePresets.value.some((p) => p.value === preset)) {
            sizePreset.value = preset;
        }
    },
);

const onSizePresetChange = (value: any) => {
    const [w, h] = String(value).split("x").map(Number);
    formData.value.autoSize = false;
    formData.value.outputWidth = w;
    formData.value.outputHeight = h;
    sizePreset.value = String(value);
    scheduleRender();
};

const onAutoSizeChange = (val: any) => {
    formData.value.autoSize = !!val;
    if (formData.value.autoSize && videoEl && videoEl.videoWidth > 0) {
        formData.value.outputWidth = videoEl.videoWidth;
        formData.value.outputHeight = videoEl.videoHeight;
    }
    scheduleRender();
};

onMounted(() => {
    if (props.video) {
        loadVideo(props.video);
    }
    if (props.backgroundImage) {
        loadBackgroundImage(props.backgroundImage);
    }
    scheduleRender();
});

onUnmounted(() => {
    playing.value = false;
    cancelAnimationFrame(animId);
    if (videoEl) {
        videoEl.pause();
        videoEl.src = "";
    }
    revokeUrl(videoUrl);
    revokeUrl(bgUrl);
});

const getValue = async (): Promise<VideoBackgroundReplaceForm> => {
    return {
        imageMode: formData.value.imageMode,
        keyColor: formData.value.keyColor,
        similarity: Math.round(formData.value.similarity * 100) / 100,
        blend: Math.round(formData.value.blend * 100) / 100,
        outputWidth: formData.value.autoSize ? 0 : formData.value.outputWidth,
        outputHeight: formData.value.autoSize ? 0 : formData.value.outputHeight,
    };
};

const setValue = (data: Partial<VideoBackgroundReplaceForm>) => {
    if (data.imageMode !== undefined) {
        formData.value.imageMode = data.imageMode;
    }
    if (data.keyColor !== undefined) {
        formData.value.keyColor = data.keyColor;
    }
    if (data.similarity !== undefined) {
        formData.value.similarity = data.similarity;
    }
    if (data.blend !== undefined) {
        formData.value.blend = data.blend;
    }
    if (data.outputWidth !== undefined || data.outputHeight !== undefined) {
        const width = data.outputWidth ?? formData.value.outputWidth;
        const height = data.outputHeight ?? formData.value.outputHeight;
        if (width > 0 && height > 0) {
            formData.value.autoSize = false;
            formData.value.outputWidth = width;
            formData.value.outputHeight = height;
        } else {
            formData.value.autoSize = true;
        }
    }
};

defineExpose({
    getValue,
    setValue,
});
</script>

<template>
    <div class="flex gap-4">
        <!-- 左侧表单 -->
        <div class="flex-1 space-y-4">
            <!-- 背景填充方式 -->
            <div class="flex items-start">
                <div class="pt-1 w-5">
                    <a-tooltip :content="t('app.vbrImageMode')" mini>
                        <icon-image />
                    </a-tooltip>
                </div>
                <div class="flex items-center gap-2 ml-2">
                    <a-radio-group
                        v-model="formData.imageMode"
                        :options="modeOptions"
                    />
                </div>
            </div>

            <!-- 抠像颜色 -->
            <div class="flex items-start">
                <div class="pt-1 w-5">
                    <a-tooltip :content="t('app.vbrKeyColor')" mini>
                        <icon-palette />
                    </a-tooltip>
                </div>
                <div class="flex items-center gap-2 ml-2">
                    <span class="text-sm">{{ t("app.vbrKeyColor") }}:</span>
                    <a-color-picker
                        v-model="formData.keyColor"
                        :default-value="formData.keyColor"
                        show-text
                        disabled-alpha
                        :format="'hex'"
                        style="width: 140px"
                    />
                </div>
            </div>

            <!-- 相似度 -->
            <div class="flex items-start">
                <div class="pt-1 w-5">
                    <a-tooltip :content="t('app.vbrSimilarityTip')" mini>
                        <icon-filter />
                    </a-tooltip>
                </div>
                <div class="flex items-center gap-2 ml-2">
                    <span class="text-sm">{{ t("app.vbrSimilarity") }}:</span>
                    <a-slider
                        v-model="formData.similarity"
                        :min="0.01"
                        :max="1"
                        :step="0.01"
                        :style="{ width: '180px' }"
                    />
                    <a-input-number
                        v-model="formData.similarity"
                        :min="0.01"
                        :max="1"
                        :step="0.01"
                        style="width: 100px"
                    />
                </div>
            </div>

            <!-- 边缘融合 -->
            <div class="flex items-start">
                <div class="pt-1 w-5">
                    <a-tooltip :content="t('app.vbrBlendTip')" mini>
                        <icon-brush />
                    </a-tooltip>
                </div>
                <div class="flex items-center gap-2 ml-2">
                    <span class="text-sm">{{ t("app.vbrBlend") }}:</span>
                    <a-slider
                        v-model="formData.blend"
                        :min="0"
                        :max="1"
                        :step="0.01"
                        :style="{ width: '180px' }"
                    />
                    <a-input-number
                        v-model="formData.blend"
                        :min="0"
                        :max="1"
                        :step="0.01"
                        style="width: 100px"
                    />
                </div>
            </div>

            <!-- 输出尺寸 -->
            <div class="flex items-start">
                <div class="pt-1 w-5">
                    <a-tooltip :content="t('app.vbrOutputSize')" mini>
                        <icon-video-camera />
                    </a-tooltip>
                </div>
                <div class="flex-1 ml-2 space-y-2">
                    <div class="flex items-center gap-2">
                        <a-checkbox
                            :model-value="formData.autoSize"
                            @change="onAutoSizeChange"
                        >
                            {{ t("app.vbrFollowVideo") }}
                        </a-checkbox>
                    </div>
                    <div class="flex items-center gap-2">
                        <a-input-number
                            v-model="formData.outputWidth"
                            :min="1"
                            :disabled="formData.autoSize"
                            :placeholder="t('common.width')"
                            style="width: 100px"
                        />
                        <span>x</span>
                        <a-input-number
                            v-model="formData.outputHeight"
                            :min="1"
                            :disabled="formData.autoSize"
                            :placeholder="t('common.height')"
                            style="width: 100px"
                        />
                        <a-select
                            v-model="sizePreset"
                            :options="sizePresets"
                            :placeholder="t('app.selectPresetSize')"
                            :disabled="formData.autoSize"
                            @change="onSizePresetChange"
                            class="ml-4 w-48"
                        />
                    </div>
                </div>
            </div>

            <div class="text-xs text-gray-400 leading-5">
                {{ t("app.vbrParamTip") }}
            </div>
        </div>

        <!-- 右侧预览 -->
        <div class="flex-1 max-w-96">
            <div
                class="border rounded p-2 flex flex-col items-center"
                :style="{ width: previewSize.width + 24 + 'px' }"
            >
                <div
                    class="relative"
                    :style="{
                        width: previewSize.width + 'px',
                        height: previewSize.height + 'px',
                        background: '#e5e7eb',
                    }"
                >
                    <canvas ref="canvasRef" class="block"></canvas>
                    <div
                        v-if="!hasVideo"
                        class="absolute inset-0 flex items-center justify-center text-xs text-gray-500 text-center px-2"
                    >
                        {{ t("app.vbrPreviewEmpty") }}
                    </div>
                </div>
                <div class="w-full flex items-center justify-between mt-2">
                    <div class="text-xs text-gray-400">
                        {{ t("app.vbrPreview") }}
                    </div>
                    <a-button
                        size="mini"
                        :disabled="!hasVideo || !videoReady"
                        @click="togglePlay"
                    >
                        <template #icon>
                            <icon-pause v-if="playing" />
                            <icon-play-arrow v-else />
                        </template>
                        {{ playing ? t("app.vbrPause") : t("app.vbrPlay") }}
                    </a-button>
                </div>
                <div class="w-full mt-1 text-xs text-gray-400">
                    {{ t("app.vbrPreviewTip") }}
                </div>
                <div
                    v-if="hasVideo && !hasImage"
                    class="w-full mt-1 text-xs text-orange-400"
                >
                    {{ t("app.vbrPreviewNeedImage") }}
                </div>
            </div>
        </div>
    </div>
</template>
