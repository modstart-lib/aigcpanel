<script setup lang="ts">
import {ref} from "vue";
import {Dialog} from "../../../lib/dialog";
import {t} from "../../../lang";
import VideoPlayer from "../../../components/common/VideoPlayer.vue";
import {VideoTemplateRecord, VideoTemplateService} from "../../../service/VideoTemplateService";
import {ffmpegVideoNormal} from "../../../lib/ffmpeg";
import {ffprobeVideoInfo} from "../../../lib/ffprobe";

const visible = ref(false);
const videoPlayer = ref<InstanceType<typeof VideoPlayer> | null>(null);

const formData = ref({
    name: "",
    video: "",
});

const add = () => {
    formData.value.name = "";
    formData.value.video = "";
    visible.value = true;
};

const doSelectFile = async () => {
    const path = await window.$mapi.file.openFile({
        accept: "video/*",
    });
    if (path) {
        formData.value.video = path;
        // videoPlayer.value?.loadVideo(path)
    }
};

const doSave = async () => {
    if (!formData.value.name) {
        Dialog.tipError(t("hint.inputName"));
        return;
    }
    if (!formData.value.video) {
        Dialog.tipError(t("hint.selectVideo"));
        return;
    }
    const exists = await VideoTemplateService.getByName(formData.value.name);
    if (exists) {
        Dialog.tipError(t("error.nameDuplicate"));
        return;
    }
    try {
        Dialog.loadingOn(t("msg.videoProcessing"));
        const normalPath = await ffmpegVideoNormal(formData.value.video, {
            durationMax: 120,
        });
        const videoInfo = await ffprobeVideoInfo(normalPath);
        const videoPathFull = await $mapi.file.hubSave(normalPath);
        await VideoTemplateService.insert({
            name: formData.value.name,
            video: videoPathFull,
            info: videoInfo,
        } as VideoTemplateRecord);
        visible.value = false;
        emit("update");
    } catch (e) {
        console.error(e);
        Dialog.tipError(t("error.videoProcessFailed") + ":" + e);
    } finally {
        Dialog.loadingOff();
    }
};

defineExpose({
    add,
});

const emit = defineEmits({
    update: () => true,
});
</script>

<template>
    <a-modal v-model:visible="visible" width="800px" title-align="start">
        <template #title>
            {{ $t("avatar.addVideo") }}
        </template>
        <template #footer>
            <a-button type="primary" @click="doSave">
                {{ $t("common.save") }}
            </a-button>
        </template>
        <div style="max-height: 60vh">
            <div class="flex p-4">
                <div class="w-1/2 flex-shrink-0 mr-5">
                    <a-form :model="{}" layout="vertical">
                        <a-form-item :label="$t('common.name')" required>
                            <a-input v-model="formData.name" />
                        </a-form-item>
                        <a-form-item :label="$t('media.video')" required>
                            <div class="w-full">
                                <div class="mb-3" v-if="formData.video">
                                    <div class="h-52 rounded-lg p-2 bg-black">
                                        <VideoPlayer ref="videoPlayer" :url="`file://${formData.video}`" />
                                    </div>
                                </div>
                                <div class="mb-3" v-if="!formData.video">
                                    <div
                                        class="h-52 bg-gray-100 border rounded-lg flex items-center text-center cursor-pointer"
                                        @click="doSelectFile"
                                    >
                                        <div class="mx-auto">
                                            <div>
                                                <icon-video-camera class="text-xl" />
                                            </div>
                                            <div>
                                                {{ $t("media.selectVideo") }}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div v-else class="mb-3">
                                    <a-button @click="doSelectFile">
                                        <template #icon>
                                            <icon-upload />
                                        </template>
                                        {{ $t("media.selectVideo") }}
                                    </a-button>
                                </div>
                            </div>
                        </a-form-item>
                    </a-form>
                </div>
                <div class="flex-grow">
                    <div class="text-lg font-bold">{{ $t("avatar.example") }}</div>
                    <div class="mb-3">
                        <div class="mt-1 grid grid-cols-3 gap-4">
                            <div class="flex flex-col items-center">
                                <img class="w-14 h-14 mb-3" src="./../../../assets/image/videoTemplate/1.png" />
                                <div class="mt-1 flex items-center gap-1 justify-center">
                                    <icon-check-circle class="text-green-500" />
                                    <span class="text-xs">{{ $t("avatar.selfie") }}</span>
                                </div>
                            </div>
                            <div class="flex flex-col items-center">
                                <img class="w-14 h-14 mb-3" src="./../../../assets/image/videoTemplate/2.png" />
                                <div class="mt-1 flex items-center gap-1 justify-center">
                                    <icon-check-circle class="text-green-500" />
                                    <span class="text-xs">{{ $t("avatar.canOpenCloseMouth") }}</span>
                                </div>
                            </div>
                            <div class="flex flex-col items-center">
                                <img class="w-14 h-14 mb-3" src="./../../../assets/image/videoTemplate/3.png" />
                                <div class="mt-1 flex items-center gap-1 justify-center">
                                    <icon-close-circle class="text-red-500" />
                                    <span class="text-xs">{{ $t("avatar.faceInterference") }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="text-lg font-bold">{{ $t("avatar.videoReq") }}</div>
                    <div class="bg-gray-100 mt-2 p-3 rounded-lg leading-6 text-xs">
                        <div>{{ $t("guide.videoReq1") }}</div>
                        <div>
                            {{
                                $t(
                                    "guide.videoReq2"
                                )
                            }}
                        </div>
                        <div>
                            {{
                                $t(
                                    "guide.videoReq3"
                                )
                            }}
                        </div>
                        <div>{{ $t("guide.videoReq4") }}</div>
                    </div>
                </div>
            </div>
        </div>
    </a-modal>
</template>
