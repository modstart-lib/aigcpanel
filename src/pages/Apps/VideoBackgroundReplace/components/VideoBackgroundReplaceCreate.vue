<script setup lang="ts">
import { testActionSet, testActionUnset } from "@/utils/test";
import { onMounted, onUnmounted, ref } from "vue";
import FileSelector from "../../../../components/common/FileSelector.vue";
import { dataAutoSaveDraft } from "../../../../components/common/util";
import { t } from "../../../../lang";
import { Dialog } from "../../../../lib/dialog";
import { TaskRecord, TaskService } from "../../../../service/TaskService";
import VideoBackgroundReplaceParamForm from "./VideoBackgroundReplaceParamForm.vue";

const emit = defineEmits<{
    submitted: [];
}>();

const paramForm = ref<InstanceType<
    typeof VideoBackgroundReplaceParamForm
> | null>(null);

const formData = ref({
    video: "",
    image: "",
});

const { clearDraft } = dataAutoSaveDraft(
    "VideoBackgroundReplaceCreate.formData",
    formData.value,
);

const doSubmit = async () => {
    const paramValue = await paramForm.value?.getValue();
    if (!paramValue) {
        return;
    }
    if (!formData.value.video) {
        Dialog.tipError(t("error.vbrSelectVideo"));
        return;
    }
    if (!formData.value.image) {
        Dialog.tipError(t("error.vbrSelectImage"));
        return;
    }

    const taskTitle = $mapi.file.pathToName(formData.value.video, false);
    const record: TaskRecord = {
        biz: "VideoBackgroundReplace",
        title: taskTitle,
        serverName: "",
        serverTitle: "",
        serverVersion: "",
        modelConfig: {
            video: formData.value.video,
            image: formData.value.image,
            ...paramValue,
        },
        param: {},
    };
    const id = await TaskService.submit(record);
    formData.value.video = "";
    formData.value.image = "";
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
                <a-tooltip :content="t('app.vbrGreenVideo')" mini>
                    <icon-video-camera />
                </a-tooltip>
            </div>
            <div class="flex items-center gap-2">
                <FileSelector :extensions="['mp4']" v-model="formData.video" />
            </div>
        </div>
        <div class="mb-4 flex items-start">
            <div class="pt-1 w-5">
                <a-tooltip :content="t('app.vbrBackgroundImage')" mini>
                    <icon-image />
                </a-tooltip>
            </div>
            <div class="flex items-center gap-2">
                <FileSelector
                    :extensions="['jpg', 'png', 'jpeg']"
                    v-model="formData.image"
                />
            </div>
        </div>
        <VideoBackgroundReplaceParamForm
            ref="paramForm"
            :video="formData.video"
            :background-image="formData.image"
        />
        <div class="flex mt-4">
            <a-button class="mr-2" type="primary" @click="doSubmit">
                <icon-send />
                {{ $t("common.submitTask") }}
            </a-button>
        </div>
    </div>
</template>
