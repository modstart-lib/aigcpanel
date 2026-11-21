<script setup lang="ts">
import { testActionSet, testActionUnset } from "@/utils/test";
import { onMounted, onUnmounted, ref } from "vue";
import FileSelector from "../../../../components/common/FileSelector.vue";
import { dataAutoSaveDraft } from "../../../../components/common/util";
import { t } from "../../../../lang";
import { Dialog } from "../../../../lib/dialog";
import { TaskRecord, TaskService } from "../../../../service/TaskService";
import FfmpegParamForm from "./FfmpegParamForm.vue";

const emit = defineEmits<{
    submitted: [];
}>();

const paramForm = ref<InstanceType<typeof FfmpegParamForm> | null>(null);

const formData = ref({
    input1: "",
    input2: "",
    input3: "",
    input4: "",
    input5: "",
});

const { clearDraft } = dataAutoSaveDraft(
    "FfmpegCreate.formData",
    formData.value,
);

const doSubmit = async () => {
    const ffmpegValue = await paramForm.value?.getValue();
    if (!ffmpegValue) {
        return;
    }
    const taskTitle = `FFmpeg-${Date.now()}`;
    const record: TaskRecord = {
        biz: "Ffmpeg",
        title: taskTitle,
        serverName: "",
        serverTitle: "",
        serverVersion: "",
        modelConfig: {
            input1: formData.value.input1,
            input2: formData.value.input2,
            input3: formData.value.input3,
            input4: formData.value.input4,
            input5: formData.value.input5,
            ...ffmpegValue,
        },
        param: {},
    };
    const id = await TaskService.submit(record);
    formData.value.input1 = "";
    formData.value.input2 = "";
    formData.value.input3 = "";
    formData.value.input4 = "";
    formData.value.input5 = "";
    emit("submitted");
    Dialog.tipSuccess(t("common.taskSubmitted"));
    clearDraft();
    return id;
};


</script>

<template>
    <div class="rounded-xl shadow border p-4">
        <div v-for="i in [1, 2, 3, 4, 5]" class="mb-4 flex items-start">
            <div class="pt-1 w-20">
                <a-tooltip :content="t('app.inputFileTooltip', { i })" mini>
                    <icon-video-camera />
                    {{ t("app.inputFileLabel", { i }) }}
                </a-tooltip>
            </div>
            <div class="flex items-center gap-2">
                <FileSelector
                    :extensions="['mp4', 'mp3', 'wav']"
                    v-model="formData[`input${i}`]"
                />
            </div>
        </div>
        <FfmpegParamForm ref="paramForm" />
        <div class="flex">
            <a-button class="mr-2" type="primary" @click="doSubmit">
                <icon-send class="mr-2" />
                {{ $t("common.submitTask") }}
            </a-button>
        </div>
    </div>
</template>
