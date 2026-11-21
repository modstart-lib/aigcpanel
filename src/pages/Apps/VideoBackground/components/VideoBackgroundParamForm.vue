<script setup lang="ts">
import * as fabric from "fabric";
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { t } from "../../../../lang";
import { Dialog } from "../../../../lib/dialog";
import { FileUtil } from "../../../../lib/file";

const props = defineProps<{
    backgroundImage?: string;
}>();

const formData = ref({
    imageMode: "cover" as "cover" | "contain",
    videoX: 96,
    videoY: 54,
    videoWidth: 1728,
    videoHeight: 972,
    outputWidth: 1920,
    outputHeight: 1080,
    videoBorderWidth: 30,
    videoBorderColor: "#FFFFFF",
    videoBorderOpacity: 50,
    videoBorderRadius: 30,
});

type VideoBackgroundForm = {
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

const presetPortrait = computed(() => t("app.presetPortrait"));
const presetSquare = computed(() => t("app.presetSquare"));

const imageSizePresets = computed(() => [
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
    { label: `${presetSquare.value}480 (480x480)`, value: "480x480" },
]);

const videoSizePresets = computed(() => [
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
    { label: `${presetSquare.value}480 (480x480)`, value: "480x480" },
]);

const imagePreset = ref("1920x1080");
const videoPreset = ref("1920x1080");

const modeOptions = computed(() => [
    { label: t("app.modeCover"), value: "cover" },
    { label: t("app.modeContain"), value: "contain" },
]);

const canvasRef = ref<HTMLCanvasElement | null>(null);
let canvas: fabric.Canvas | null = null;
let backgroundRect: fabric.Rect | null = null;
let videoRect: fabric.Rect | null = null;
let backgroundImageObj: fabric.Image | null = null;
let imgWidth = 0;
let imgHeight = 0;

const previewSize = computed(() => {
    const canvasSize = 360;
    return { width: canvasSize, height: canvasSize };
});

const getBackgroundRectSize = () => {
    const maxSize = 300;
    const aspectRatio =
        formData.value.outputWidth / formData.value.outputHeight;
    let width, height;
    if (aspectRatio > 1) {
        // 宽屏
        width = maxSize;
        height = maxSize / aspectRatio;
    } else {
        // 竖屏或正方形
        height = maxSize;
        width = maxSize * aspectRatio;
    }
    return { width, height };
};

const initCanvas = () => {
    if (!canvasRef.value) return;
    canvas = new fabric.Canvas(canvasRef.value, {
        width: previewSize.value.width,
        height: previewSize.value.height,
        selection: false,
        backgroundColor: "transparent", // 画布整体变为透明
    });

    const bgSize = getBackgroundRectSize();
    const bgLeft = (previewSize.value.width - bgSize.width) / 2;
    const bgTop = (previewSize.value.height - bgSize.height) / 2;
    const scale = bgSize.width / formData.value.outputWidth;

    // Background rect (居中，留边距，增加灰色边框)
    backgroundRect = new fabric.Rect({
        left: bgLeft,
        top: bgTop,
        width: bgSize.width,
        height: bgSize.height,
        fill: "#f0f0f0",
        stroke: "#cccccc", // 灰色边框
        strokeWidth: 2,
        selectable: false,
    });
    canvas.add(backgroundRect);

    // Video rect
    videoRect = new fabric.Rect({
        left:
            bgLeft +
            (formData.value.videoX / formData.value.outputWidth) * bgSize.width,
        top:
            bgTop +
            (formData.value.videoY / formData.value.outputHeight) *
                bgSize.height,
        width:
            (formData.value.videoWidth / formData.value.outputWidth) *
            bgSize.width,
        height:
            (formData.value.videoHeight / formData.value.outputHeight) *
            bgSize.height,
        fill: "rgba(59, 130, 246, 0.5)",
        stroke:
            formData.value.videoBorderWidth > 0
                ? hexToRgba(
                      formData.value.videoBorderColor,
                      formData.value.videoBorderOpacity,
                  )
                : "#3b82f6",
        strokeWidth:
            formData.value.videoBorderWidth > 0
                ? formData.value.videoBorderWidth * scale
                : 2 * scale,
        rx: formData.value.videoBorderRadius * scale,
        ry: formData.value.videoBorderRadius * scale,
        selectable: true,
        hasControls: true,
        lockScalingFlip: true,
        lockRotation: true,
    });
    canvas.add(videoRect);

    // Listen to object modified (moved or scaled)
    canvas.on("object:modified", (e: any) => {
        const bgSize = getBackgroundRectSize();
        const bgLeft = (previewSize.value.width - bgSize.width) / 2;
        const bgTop = (previewSize.value.height - bgSize.height) / 2;
        const bgRight = bgLeft + bgSize.width;
        const bgBottom = bgTop + bgSize.height;

        if (e.target === videoRect && videoRect) {
            const scaleX = formData.value.outputWidth / bgSize.width;
            const scaleY = formData.value.outputHeight / bgSize.height;
            const relativeLeft = videoRect.left! - bgLeft;
            const relativeTop = videoRect.top! - bgTop;
            formData.value.videoX = Math.round(relativeLeft * scaleX);
            formData.value.videoY = Math.round(relativeTop * scaleY);
            // Fix scaling issue by using actual scaled dimensions
            const actualWidth = videoRect.width! * (videoRect.scaleX || 1);
            const actualHeight = videoRect.height! * (videoRect.scaleY || 1);
            formData.value.videoWidth = Math.round(actualWidth * scaleX);
            formData.value.videoHeight = Math.round(actualHeight * scaleY);
        }

        canvas!.renderAll();
    });
};

const hexToRgba = (hex: string, opacity: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
};

const updateCanvas = () => {
    if (!canvas || !backgroundRect || !videoRect) return;
    canvas.setDimensions({
        width: previewSize.value.width,
        height: previewSize.value.height,
    });
    canvas.backgroundColor = "transparent"; // 确保背景色更新为透明
    const bgSize = getBackgroundRectSize();
    const bgLeft = (previewSize.value.width - bgSize.width) / 2;
    const bgTop = (previewSize.value.height - bgSize.height) / 2;
    const scale = bgSize.width / formData.value.outputWidth;
    backgroundRect.set({
        left: bgLeft,
        top: bgTop,
        width: bgSize.width,
        height: bgSize.height,
        stroke: "#cccccc",
        strokeWidth: 2,
    });
    const borderColor =
        formData.value.videoBorderWidth > 0
            ? hexToRgba(
                  formData.value.videoBorderColor,
                  formData.value.videoBorderOpacity,
              )
            : "#3b82f6";
    videoRect.set({
        left:
            bgLeft +
            (formData.value.videoX / formData.value.outputWidth) * bgSize.width,
        top:
            bgTop +
            (formData.value.videoY / formData.value.outputHeight) *
                bgSize.height,
        width:
            (formData.value.videoWidth / formData.value.outputWidth) *
            bgSize.width,
        height:
            (formData.value.videoHeight / formData.value.outputHeight) *
            bgSize.height,
        scaleX: 1,
        scaleY: 1,
        stroke: borderColor,
        strokeWidth:
            formData.value.videoBorderWidth > 0
                ? formData.value.videoBorderWidth * scale
                : 2 * scale,
        rx: formData.value.videoBorderRadius * scale,
        ry: formData.value.videoBorderRadius * scale,
        lockRotation: true,
    });
    videoRect.setCoords(); // 更新控制句柄位置
    if (backgroundImageObj && imgWidth > 0 && imgHeight > 0) {
        updateBackgroundImage(imgWidth, imgHeight);
    }
    canvas.renderAll();
};

watch(previewSize, updateCanvas);
watch(() => formData.value, updateCanvas, { deep: true });

// Watch for background image changes from props
watch(
    () => props.backgroundImage,
    (newImage) => {
        if (newImage && canvas) {
            loadBackgroundImage(newImage);
        } else if (!newImage && canvas) {
            // 清除backgroundRect的背景
            if (backgroundRect) {
                backgroundRect.set({
                    fill: "#f0f0f0",
                });
            }
            // 移除backgroundImageObj
            if (backgroundImageObj) {
                canvas.remove(backgroundImageObj);
                backgroundImageObj = null;
            }
            imgWidth = 0;
            imgHeight = 0;
            canvas.renderAll();
        }
    },
    { immediate: true, flush: "post" },
);

watch(
    [() => formData.value.outputWidth, () => formData.value.outputHeight],
    () => {
        const preset = `${formData.value.outputWidth}x${formData.value.outputHeight}`;
        if (imageSizePresets.some((p) => p.value === preset)) {
            imagePreset.value = preset;
        }
    },
);

watch(
    [() => formData.value.videoWidth, () => formData.value.videoHeight],
    () => {
        const preset = `${formData.value.videoWidth}x${formData.value.videoHeight}`;
        if (videoSizePresets.some((p) => p.value === preset)) {
            videoPreset.value = preset;
        }
    },
);

watch(
    () => formData.value.imageMode,
    () => {
        if (backgroundImageObj && imgWidth > 0 && imgHeight > 0) {
            updateBackgroundImage(imgWidth, imgHeight);
        }
    },
);

onMounted(() => {
    nextTick(() => {
        initCanvas();
        // 在canvas初始化完成后，如果有背景图片则加载
        if (props.backgroundImage) {
            loadBackgroundImage(props.backgroundImage);
        }
        // 初始化视频尺寸和位置
        // updateVideoSizeAndPosition(); // 移除此调用以保持初始值
    });
});

onUnmounted(() => {
    if (canvas) {
        canvas.dispose();
    }
});

const onImagePresetChange = (value: string) => {
    const [w, h] = value.split("x").map(Number);
    formData.value.outputWidth = w;
    formData.value.outputHeight = h;
    imagePreset.value = value;
    updateCanvas();
};

const onVideoPresetChange = (value: string) => {
    const [w, h] = value.split("x").map(Number);
    formData.value.videoWidth = w;
    formData.value.videoHeight = h;
    videoPreset.value = value;
    updateVideoSizeAndPosition();
};

const centerHorizontally = () => {
    formData.value.videoX = Math.round(
        (formData.value.outputWidth - formData.value.videoWidth) / 2,
    );
    updateCanvas();
};

const centerVertically = () => {
    formData.value.videoY = Math.round(
        (formData.value.outputHeight - formData.value.videoHeight) / 2,
    );
    updateCanvas();
};

const shrink5Percent = () => {
    formData.value.videoWidth = Math.round(formData.value.videoWidth * 0.95);
    formData.value.videoHeight = Math.round(formData.value.videoHeight * 0.95);
    updateCanvas();
};

const enlarge5Percent = () => {
    formData.value.videoWidth = Math.round(formData.value.videoWidth * 1.05);
    formData.value.videoHeight = Math.round(formData.value.videoHeight * 1.05);
    updateCanvas();
};

const updateVideoSizeAndPosition = () => {
    const outputWidth = formData.value.outputWidth;
    const outputHeight = formData.value.outputHeight;
    const videoWidth = formData.value.videoWidth;
    const videoHeight = formData.value.videoHeight;

    // 居中位置，视频尺寸保持不变
    const newVideoX = (outputWidth - videoWidth) / 2;
    const newVideoY = (outputHeight - videoHeight) / 2;

    // 更新formData
    formData.value.videoX = Math.round(newVideoX);
    formData.value.videoY = Math.round(newVideoY);

    updateCanvas();
};

const loadBackgroundImage = (imageSrc: string) => {
    if (!canvas) return;

    // Check if it's a file path
    // Use $mapi to read the file stream
    $mapi.file
        .readStream(imageSrc)
        .then((stream: ReadableStream | null) => {
            if (!stream) {
                console.error("Failed to get stream for file:", imageSrc);
                return null;
            }
            return new Response(stream, {
                headers: {
                    "Content-Type":
                        FileUtil.extensionToType(FileUtil.getExt(imageSrc)) ||
                        "application/octet-stream",
                },
            }).blob();
        })
        .then((blob: Blob | null) => {
            if (!blob) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataURL = e.target?.result as string;
                if (dataURL) {
                    loadImageFromDataURL(dataURL);
                }
            };
            reader.readAsDataURL(blob);
        })
        .catch((error) => {
            console.error("Failed to load image:", error);
        });
};

const loadImageFromDataURL = (dataURL: string) => {
    console.log("Loading image from data URL", dataURL);

    // 使用原生Image对象预加载，确保图片加载成功
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
        console.log(
            "Native image loaded successfully, setting background image",
        );

        imgWidth = img.width;
        imgHeight = img.height;

        // 移除之前的backgroundImageObj
        if (backgroundImageObj) {
            canvas!.remove(backgroundImageObj);
            backgroundImageObj = null;
        }

        // 创建fabric.Image对象
        backgroundImageObj = new fabric.Image(img, {
            selectable: false,
            hasControls: false,
            lockMovementX: true,
            lockMovementY: true,
            lockScalingX: true,
            lockScalingY: true,
        });

        // 更新图片尺寸和位置
        updateBackgroundImage(imgWidth, imgHeight);

        // 添加到canvas
        canvas!.add(backgroundImageObj);
        // 重新添加videoRect以确保在前面
        if (videoRect) {
            canvas!.remove(videoRect);
            canvas!.add(videoRect);
        }
        canvas!.renderAll();
    };
    img.onerror = (error) => {
        console.error("Failed to load image:", error);
        Dialog.tipError(t("error.backgroundImageLoadFailed"));
    };
    img.src = dataURL;
};

const updateBackgroundImage = (imgWidth: number, imgHeight: number) => {
    if (!backgroundImageObj || !canvas) return;

    const bgSize = getBackgroundRectSize();
    const bgLeft = (previewSize.value.width - bgSize.width) / 2;
    const bgTop = (previewSize.value.height - bgSize.height) / 2;

    const imageMode = formData.value.imageMode;
    let scale: number;

    if (imageMode === "cover") {
        scale = Math.max(bgSize.width / imgWidth, bgSize.height / imgHeight);
    } else if (imageMode === "contain") {
        scale = Math.min(bgSize.width / imgWidth, bgSize.height / imgHeight);
    } else {
        scale = Math.min(bgSize.width / imgWidth, bgSize.height / imgHeight);
    }

    const newWidth = imgWidth * scale;
    const newHeight = imgHeight * scale;
    const left = bgLeft + (bgSize.width - newWidth) / 2;
    const top = bgTop + (bgSize.height - newHeight) / 2;

    backgroundImageObj.set({
        left: left,
        top: top,
        scaleX: scale,
        scaleY: scale,
    });

    // 设置clipPath
    if (imageMode === "cover") {
        backgroundImageObj.set({
            clipPath: new fabric.Rect({
                left: bgLeft,
                top: bgTop,
                width: bgSize.width,
                height: bgSize.height,
                absolutePositioned: true,
            }),
        });
    } else {
        backgroundImageObj.set({
            clipPath: undefined,
        });
    }

    backgroundImageObj.setCoords();
    canvas.renderAll();
};

const getValue = async (): Promise<VideoBackgroundForm | undefined> => {
    const data: VideoBackgroundForm = {
        imageMode: formData.value.imageMode,
        videoX: formData.value.videoX,
        videoY: formData.value.videoY,
        videoWidth: formData.value.videoWidth,
        videoHeight: formData.value.videoHeight,
        outputWidth: formData.value.outputWidth,
        outputHeight: formData.value.outputHeight,
        videoBorderWidth: formData.value.videoBorderWidth,
        videoBorderColor: formData.value.videoBorderColor,
        videoBorderOpacity: formData.value.videoBorderOpacity,
        videoBorderRadius: formData.value.videoBorderRadius,
    };
    return data;
};

const setValue = (data: Partial<VideoBackgroundForm>) => {
    if (data.imageMode !== undefined) {
        formData.value.imageMode = data.imageMode;
    }
    if (data.videoX !== undefined) {
        formData.value.videoX = data.videoX;
    }
    if (data.videoY !== undefined) {
        formData.value.videoY = data.videoY;
    }
    if (data.videoWidth !== undefined) {
        formData.value.videoWidth = data.videoWidth;
    }
    if (data.videoHeight !== undefined) {
        formData.value.videoHeight = data.videoHeight;
    }
    if (data.outputWidth !== undefined) {
        formData.value.outputWidth = data.outputWidth;
    }
    if (data.outputHeight !== undefined) {
        formData.value.outputHeight = data.outputHeight;
    }
    if (data.videoBorderWidth !== undefined) {
        formData.value.videoBorderWidth = data.videoBorderWidth;
    }
    if (data.videoBorderColor !== undefined) {
        formData.value.videoBorderColor = data.videoBorderColor;
    }
    if (data.videoBorderOpacity !== undefined) {
        formData.value.videoBorderOpacity = data.videoBorderOpacity;
    }
    if (data.videoBorderRadius !== undefined) {
        formData.value.videoBorderRadius = data.videoBorderRadius;
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
            <!-- 图片尺寸 -->
            <div class="flex items-start">
                <div class="pt-1 w-5">
                    <a-tooltip :content="t('app.outputSize')" mini>
                        <icon-video-camera />
                    </a-tooltip>
                </div>
                <div class="flex-1 ml-2">
                    <div class="flex items-center gap-2">
                        <a-input-number
                            v-model="formData.outputWidth"
                            :min="1"
                            :placeholder="t('common.width')"
                            style="width: 100px"
                        />
                        <span>x</span>
                        <a-input-number
                            v-model="formData.outputHeight"
                            :min="1"
                            :placeholder="t('common.height')"
                            style="width: 100px"
                        />
                        <a-select
                            v-model="imagePreset"
                            :options="imageSizePresets"
                            :placeholder="t('app.selectPresetSize')"
                            @change="onImagePresetChange"
                            class="ml-4 w-48"
                        />
                    </div>
                </div>
            </div>

            <!-- 视频尺寸 -->
            <div class="flex items-start">
                <div class="pt-1 w-5">
                    <a-tooltip :content="t('app.videoSize')" mini>
                        <icon-video-camera />
                    </a-tooltip>
                </div>
                <div class="flex-1 ml-2">
                    <div class="flex items-center gap-2">
                        <a-input-number
                            v-model="formData.videoWidth"
                            :min="1"
                            :placeholder="t('common.width')"
                            style="width: 100px"
                        />
                        <span>x</span>
                        <a-input-number
                            v-model="formData.videoHeight"
                            :min="1"
                            :placeholder="t('common.height')"
                            style="width: 100px"
                        />
                        <a-select
                            v-model="videoPreset"
                            :options="videoSizePresets"
                            :placeholder="t('app.selectPresetSize')"
                            @change="onVideoPresetChange"
                            class="ml-4 w-48"
                        />
                    </div>
                </div>
            </div>

            <!-- 图片模式 -->
            <div class="flex items-start">
                <div class="pt-1 w-5">
                    <a-tooltip :content="t('app.imageMode')" mini>
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

            <!-- 视频位置 -->
            <div class="flex items-start">
                <div class="pt-1 w-5">
                    <a-tooltip :content="t('app.videoPosition')" mini>
                        <icon-drag-arrow />
                    </a-tooltip>
                </div>
                <div class="flex items-center gap-2 ml-2">
                    <a-input-number
                        v-model="formData.videoX"
                        placeholder="X"
                        style="width: 80px"
                    />
                    <a-input-number
                        v-model="formData.videoY"
                        placeholder="Y"
                        style="width: 80px"
                    />
                    <a-button-group>
                        <a-button
                            @click="centerHorizontally"
                            :title="t('app.centerHorizontal')"
                        >
                            <icon-align-center />
                        </a-button>
                        <a-button
                            @click="centerVertically"
                            :title="t('app.centerVertical')"
                        >
                            <icon-align-center
                                style="transform: rotate(90deg)"
                            />
                        </a-button>
                        <a-button
                            @click="shrink5Percent"
                            :title="t('app.shrink5')"
                        >
                            <icon-zoom-out />
                        </a-button>
                        <a-button
                            @click="enlarge5Percent"
                            :title="t('app.enlarge5')"
                        >
                            <icon-zoom-in />
                        </a-button>
                    </a-button-group>
                </div>
            </div>

            <!-- 边框设置 -->
            <div class="flex items-start">
                <div class="pt-1 w-5">
                    <a-tooltip :content="t('app.borderSettings')" mini>
                        <icon-settings />
                    </a-tooltip>
                </div>
                <div class="flex-1 ml-2 space-y-2">
                    <div class="flex items-center gap-2">
                        <span class="text-sm">{{ t("app.borderWidth") }}:</span>
                        <a-input-number
                            v-model="formData.videoBorderWidth"
                            :min="0"
                            :placeholder="t('app.borderWidthPlaceholder')"
                            style="width: 100px"
                        />
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-sm">{{ t("app.borderColor") }}:</span>
                        <a-color-picker
                            v-model="formData.videoBorderColor"
                            :default-value="formData.videoBorderColor"
                            show-text
                            disabled-alpha
                            :format="'hex'"
                            style="width: 120px"
                        />
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-sm"
                            >{{ t("app.borderOpacity") }}:</span
                        >
                        <a-slider
                            v-model="formData.videoBorderOpacity"
                            :min="0"
                            :max="100"
                            :step="1"
                            :style="{ width: '120px' }"
                        />
                        <span class="text-sm"
                            >{{ formData.videoBorderOpacity }}%</span
                        >
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-sm"
                            >{{ t("app.borderRadius") }}:</span
                        >
                        <a-input-number
                            v-model="formData.videoBorderRadius"
                            :min="0"
                            :placeholder="t('app.borderRadiusPlaceholder')"
                            style="width: 100px"
                        />
                    </div>
                </div>
            </div>
        </div>

        <!-- 右侧预览 -->
        <div class="flex-1 max-w-96">
            <div
                class="border rounded p-2"
                :style="{
                    width: previewSize.width + 'px',
                    height: previewSize.height + 'px',
                    position: 'relative',
                    background: 'transparent',
                }"
            >
                <canvas ref="canvasRef"></canvas>
            </div>
        </div>
    </div>
</template>
