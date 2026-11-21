<script setup lang="ts">
import { testActionSet, testActionUnset } from "@/utils/test";
import { onMounted, onUnmounted, ref } from "vue";
import FilesSelector from "../../../../components/common/FilesSelector.vue";
import { dataAutoSaveDraft } from "../../../../components/common/util";
import { t } from "../../../../lang";
import { Dialog } from "../../../../lib/dialog";
import { TaskRecord, TaskService } from "../../../../service/TaskService";
import VideoMergeParamForm from "./VideoMergeParamForm.vue";

const emit = defineEmits<{
    submitted: [];
}>();

const paramForm = ref<InstanceType<typeof VideoMergeParamForm> | null>(null);

const formData = ref({
    videos: [] as string[],
});

const { clearDraft } = dataAutoSaveDraft(
    "VideoMergeCreate.formData",
    formData.value,
);

const doSubmit = async () => {
    const videoMergeValue = await paramForm.value?.getValue();
    if (!videoMergeValue) {
        return;
    }
    if (!formData.value.videos || formData.value.videos.length < 2) {
        Dialog.tipError(t("error.atLeastTwoVideos"));
        return;
    }

    const taskTitle =
        $mapi.file.pathToName(formData.value.videos[0], false) + "_merge";
    const record: TaskRecord = {
        biz: "VideoMerge",
        title: taskTitle,
        serverName: "",
        serverTitle: "",
        serverVersion: "",
        modelConfig: {
            videos: formData.value.videos,
            ...videoMergeValue,
        },
        param: {},
    };
    const id = await TaskService.submit(record);
    formData.value.videos = [];
    emit("submitted");
    Dialog.tipSuccess(t("common.taskSubmitted"));
    clearDraft();
    return id;
};


</script>

<template>
    <div class="rounded-xl shadow border p-4">
        <div class="mb-4 flex items-start">
            <div class="pt-1 w-5">
                <a-tooltip :content="t('app.videoFile')" mini>
                    <icon-video-camera />
                </a-tooltip>
            </div>
            <div class="flex items-center gap-2">
                <FilesSelector
                    :extensions="['mp4', 'avi', 'mov', 'mkv']"
                    v-model="formData.videos"
                />
            </div>
        </div>
        <VideoMergeParamForm ref="paramForm" />
        <div class="flex">
            <a-button class="mr-2" type="primary" @click="doSubmit">
                <icon-send class="mr-2" />
                {{ $t("common.submitTask") }}
            </a-button>
        </div>
    </div>
</template>
