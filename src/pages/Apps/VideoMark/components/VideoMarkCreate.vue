<script setup lang="ts">
import { testActionSet, testActionUnset } from "@/utils/test";
import { onMounted, onUnmounted, ref } from "vue";
import FileSelector from "../../../../components/common/FileSelector.vue";
import { dataAutoSaveDraft } from "../../../../components/common/util";
import { t } from "../../../../lang";
import { Dialog } from "../../../../lib/dialog";
import { TaskRecord, TaskService } from "../../../../service/TaskService";
import VideoMarkParamForm from "./VideoMarkParamForm.vue";

const emit = defineEmits<{
    submitted: [];
}>();
const formData = ref({
    video: "",
});

const paramForm = ref<InstanceType<typeof VideoMarkParamForm> | null>(null);

const { clearDraft } = dataAutoSaveDraft(
    "VideoMarkCreate.formData",
    formData.value,
);

const doSubmit = async () => {
    const value = await paramForm.value?.getValue();
    if (!value) {
        return;
    }
    if (!formData.value.video) {
        Dialog.tipError(t("error.selectVideoFile"));
        return;
    }
    const taskTitle = $mapi.file.pathToName(formData.value.video, false);
    const record: TaskRecord = {
        biz: "VideoMark",
        title: taskTitle,
        serverName: "",
        serverTitle: "",
        serverVersion: "",
        modelConfig: {
            video: formData.value.video,
            ...value,
        },
        param: {},
    };
    const id = await TaskService.submit(record);
    formData.value.video = "";
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
                <a-tooltip :content="$t('app.videoFile')" mini>
                    <icon-video-camera />
                </a-tooltip>
            </div>
            <div class="flex items-center gap-2">
                <FileSelector :extensions="['mp4']" v-model="formData.video" />
            </div>
        </div>
        <VideoMarkParamForm ref="paramForm" />
        <div class="flex">
            <a-button class="mr-2" type="primary" @click="doSubmit">
                <icon-send class="mr-2" />
                {{ $t("common.submitTask") }}
            </a-button>
        </div>
    </div>
</template>
