<script setup lang="ts">
import { ref } from "vue";
import { Dialog } from "../../../lib/dialog";
import { t } from "../../../lang";
import { FileUtil } from "../../../lib/file";
import VideoPlayer from "../../../components/common/VideoPlayer.vue";
import {
    VideoTemplateRecord,
    VideoTemplateService,
} from "../../../service/VideoTemplateService";
import {
    ffmpegImageToVideo,
    ffmpegVideoNormal,
    ffmpegVideoPreview,
} from "../../../lib/ffmpeg";
import { ffprobeVideoCodec, ffprobeVideoInfo } from "../../../lib/ffprobe";

const videoExtensions = ["mp4", "mov", "avi", "mkv", "webm", "flv", "m4v"];
const imageExtensions = ["jpg", "jpeg", "png", "webp", "bmp"];

const visible = ref(false);
const videoPlayer = ref<InstanceType<typeof VideoPlayer> | null>(null);

const onVisibleChange = (v: boolean) => {
    if (!v) {
        videoPlayer.value?.pause?.();
    }
};

const mediaType = ref<"video" | "image">("video");
const formData = ref({
    name: "",
    video: "",
});
const previewVideoPath = ref("");
const previewImagePath = ref("");
const isConvertingPreview = ref(false);

const resetMedia = () => {
    formData.value.video = "";
    previewVideoPath.value = "";
    previewImagePath.value = "";
    isConvertingPreview.value = false;
};

const add = () => {
    formData.value.name = "";
    mediaType.value = "video";
    resetMedia();
    visible.value = true;
};

// Switching between video and image clears the current selection
const onMediaTypeChange = () => {
    resetMedia();
};

const doSelectFile = async () => {
    const isImage = mediaType.value === "image";
    const path = await window.$mapi.file.openFile({
        filters: [
            {
                name: t(isImage ? "media.image" : "media.video"),
                extensions: isImage ? imageExtensions : videoExtensions,
            },
        ],
    });
    if (!path) return;
    formData.value.video = path;
    previewVideoPath.value = "";
    previewImagePath.value = "";
    if (isImage) {
        // Images need no conversion for preview, the video is built on save
        previewImagePath.value = path;
        return;
    }
    // 检测视频编码，非 H264 或 mov 格式需要转换
    const ext = FileUtil.getExt(path);
    let needsConvert = ext === "mov";
    if (!needsConvert) {
        try {
            const codec = await ffprobeVideoCodec(path);
            needsConvert = codec !== "h264";
        } catch (e) {
            needsConvert = true;
        }
    }
    if (needsConvert) {
        isConvertingPreview.value = true;
        try {
            previewVideoPath.value = await ffmpegVideoPreview(path);
        } catch (e) {
            console.error(e);
            Dialog.tipError(t("error.videoPreviewConvertFailed") + ":" + e);
        } finally {
            isConvertingPreview.value = false;
        }
    } else {
        previewVideoPath.value = path;
    }
};

const doSave = async () => {
    if (!formData.value.name) {
        Dialog.tipError(t("hint.inputName"));
        return;
    }
    if (!formData.value.video) {
        Dialog.tipError(
            mediaType.value === "image"
                ? t("hint.selectImage")
                : t("hint.selectVideo"),
        );
        return;
    }
    const exists = await VideoTemplateService.getByName(formData.value.name);
    if (exists) {
        Dialog.tipError(t("error.nameDuplicate"));
        return;
    }
    try {
        Dialog.loadingOn(
            mediaType.value === "image"
                ? t("msg.imageToVideoProcessing")
                : t("msg.videoProcessing"),
        );
        // A still image is turned into a 5s video first, then both sources go
        // through the same normalizing pipeline
        const sourcePath =
            mediaType.value === "image"
                ? await ffmpegImageToVideo(formData.value.video)
                : formData.value.video;
        const normalPath = await ffmpegVideoNormal(sourcePath, {
            durationMax: 120,
        });
        const videoInfo = await ffprobeVideoInfo(normalPath);
        const videoPathFull = await $mapi.file.hubSave(normalPath);
        await VideoTemplateService.insert({
            name: formData.value.name,
            video: videoPathFull,
            info: {
                ...videoInfo,
                sourceType: mediaType.value,
            },
        } as VideoTemplateRecord);
        visible.value = false;
        emit("update");
    } catch (e) {
        console.error(e);
        Dialog.tipError(
            (mediaType.value === "image"
                ? t("error.imageToVideoFailed")
                : t("error.videoProcessFailed")) +
                ":" +
                e,
        );
    } finally {
        Dialog.loadingOff();
    }
};

defineExpose({
    add,
    fill(params: { name?: string; video?: string }) {
        if (params.name !== undefined) formData.value.name = params.name;
        if (params.video !== undefined) {
            formData.value.video = params.video;
            previewVideoPath.value = params.video;
        }
    },
    doSave,
});

const emit = defineEmits({
    update: () => true,
});
</script>

<template>
    <a-modal
        v-model:visible="visible"
        width="min(800px, 95vw)"
        title-align="start"
        @update:visible="onVisibleChange"
    >
        <template #title>
            {{ $t("avatar.addVideo") }}
        </template>
        <template #footer>
            <a-button type="primary" @click="doSave">
                {{ $t("common.save") }}
            </a-button>
        </template>
        <div>
            <div class="flex p-4">
                <div class="w-1/2 flex-shrink-0 mr-5">
                    <a-radio-group
                        v-model="mediaType"
                        type="button"
                        class="mb-4"
                        @change="onMediaTypeChange"
                    >
                        <a-radio value="video">{{
                            $t("avatar.video")
                        }}</a-radio>
                        <a-radio value="image">{{
                            $t("avatar.image")
                        }}</a-radio>
                    </a-radio-group>
                    <a-form :model="{}" layout="vertical">
                        <a-form-item :label="$t('common.name')" required>
                            <a-input v-model="formData.name" />
                        </a-form-item>
                        <a-form-item
                            :label="
                                mediaType === 'image'
                                    ? $t('media.image')
                                    : $t('media.video')
                            "
                            required
                        >
                            <div class="w-full">
                                <div class="mb-3" v-if="formData.video">
                                    <div
                                        class="h-52 rounded-lg p-2 bg-black relative"
                                    >
                                        <div
                                            v-if="isConvertingPreview"
                                            class="absolute inset-0 flex flex-col items-center justify-center text-white text-sm gap-2"
                                        >
                                            <icon-loading
                                                class="text-2xl animate-spin"
                                            />
                                            <span>{{
                                                $t("msg.videoPreviewConverting")
                                            }}</span>
                                        </div>
                                        <img
                                            v-else-if="
                                                mediaType === 'image' &&
                                                previewImagePath
                                            "
                                            :src="`file://${previewImagePath}`"
                                            class="w-full h-full object-contain"
                                        />
                                        <VideoPlayer
                                            v-else-if="previewVideoPath"
                                            ref="videoPlayer"
                                            :url="`file://${previewVideoPath}`"
                                        />
                                        <div
                                            v-if="
                                                mediaType === 'image' &&
                                                previewImagePath &&
                                                !isConvertingPreview
                                            "
                                            class="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white text-xs rounded px-2 py-1"
                                        >
                                            {{
                                                $t("msg.imageWillGenerateVideo")
                                            }}
                                        </div>
                                    </div>
                                </div>
                                <div class="mb-3" v-if="!formData.video">
                                    <div
                                        class="h-52 bg-gray-100 border rounded-lg flex items-center text-center cursor-pointer"
                                        @click="doSelectFile"
                                    >
                                        <div class="mx-auto">
                                            <div>
                                                <icon-image
                                                    v-if="mediaType === 'image'"
                                                    class="text-xl"
                                                />
                                                <icon-video-camera
                                                    v-else
                                                    class="text-xl"
                                                />
                                            </div>
                                            <div>
                                                {{
                                                    mediaType === "image"
                                                        ? $t(
                                                              "media.selectImage",
                                                          )
                                                        : $t(
                                                              "media.selectVideo",
                                                          )
                                                }}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div v-else class="mb-3">
                                    <a-button @click="doSelectFile">
                                        <template #icon>
                                            <icon-upload />
                                        </template>
                                        {{
                                            mediaType === "image"
                                                ? $t("media.selectImage")
                                                : $t("media.selectVideo")
                                        }}
                                    </a-button>
                                </div>
                            </div>
                        </a-form-item>
                    </a-form>
                </div>
                <div class="flex-grow">
                    <div class="text-lg font-bold">
                        {{ $t("avatar.example") }}
                    </div>
                    <div class="mb-3">
                        <div class="mt-1 grid grid-cols-3 gap-4">
                            <div class="flex flex-col items-center">
                                <img
                                    class="w-14 h-14 mb-3"
                                    src="./../../../assets/image/videoTemplate/1.png"
                                />
                                <div
                                    class="mt-1 flex items-center gap-1 justify-center"
                                >
                                    <icon-check-circle class="text-green-500" />
                                    <span class="text-xs">{{
                                        $t("avatar.selfie")
                                    }}</span>
                                </div>
                            </div>
                            <div class="flex flex-col items-center">
                                <img
                                    class="w-14 h-14 mb-3"
                                    src="./../../../assets/image/videoTemplate/2.png"
                                />
                                <div
                                    class="mt-1 flex items-center gap-1 justify-center"
                                >
                                    <icon-check-circle class="text-green-500" />
                                    <span class="text-xs">{{
                                        $t("avatar.canOpenCloseMouth")
                                    }}</span>
                                </div>
                            </div>
                            <div class="flex flex-col items-center">
                                <img
                                    class="w-14 h-14 mb-3"
                                    src="./../../../assets/image/videoTemplate/3.png"
                                />
                                <div
                                    class="mt-1 flex items-center gap-1 justify-center"
                                >
                                    <icon-close-circle class="text-red-500" />
                                    <span class="text-xs">{{
                                        $t("avatar.faceInterference")
                                    }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="text-lg font-bold">
                        {{
                            mediaType === "image"
                                ? $t("avatar.imageReq")
                                : $t("avatar.videoReq")
                        }}
                    </div>
                    <div
                        class="bg-gray-100 mt-2 p-3 rounded-lg leading-6 text-xs"
                    >
                        <template v-if="mediaType === 'image'">
                            <div>{{ $t("guide.imageReq1") }}</div>
                            <div>{{ $t("guide.imageReq2") }}</div>
                            <div>{{ $t("guide.imageReq3") }}</div>
                            <div>{{ $t("guide.imageReq4") }}</div>
                        </template>
                        <template v-else>
                            <div>{{ $t("guide.videoReq1") }}</div>
                            <div>
                                {{ $t("guide.videoReq2") }}
                            </div>
                            <div>
                                {{ $t("guide.videoReq3") }}
                            </div>
                            <div>{{ $t("guide.videoReq4") }}</div>
                        </template>
                    </div>
                </div>
            </div>
        </div>
    </a-modal>
</template>
