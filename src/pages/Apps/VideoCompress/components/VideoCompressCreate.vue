<script setup lang="ts">
import { testActionSet, testActionUnset } from "@/utils/test";
import { onMounted, onUnmounted, ref } from "vue";
import FileSelector from "../../../../components/common/FileSelector.vue";
import { dataAutoSaveDraft } from "../../../../components/common/util";
import { t } from "../../../../lang";
import { Dialog } from "../../../../lib/dialog";
import { TaskRecord, TaskService } from "../../../../service/TaskService";
import VideoCompressParamForm from "./VideoCompressParamForm.vue";

const emit = defineEmits<{
    submitted: [];
}>();

const paramForm = ref<InstanceType<typeof VideoCompressParamForm> | null>(null);

const formData = ref({
    file: "",
});

const { clearDraft } = dataAutoSaveDraft(
    "VideoCompressCreate.formData",
    formData.value,
);

const doSubmit = async () => {
    const videoCompressValue = await paramForm.value?.getValue();
    if (!videoCompressValue) {
        return;
    }
    if (!formData.value.file) {
        Dialog.tipError(t("error.selectFile"));
        return;
    }

    const taskTitle = $mapi.file.pathToName(formData.value.file, false);
    const record: TaskRecord = {
        biz: "VideoCompress",
        title: taskTitle,
        serverName: "",
        serverTitle: "",
        serverVersion: "",
        modelConfig: {
            file: formData.value.file,
            ...videoCompressValue,
        },
        param: {},
    };
    const id = await TaskService.submit(record);
    formData.value.file = "";
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
                    <icon-file-video />
                </a-tooltip>
            </div>
            <div class="flex items-center gap-2">
                <FileSelector
                    :extensions="['mp4', 'avi', 'mov', 'mkv', 'wmv']"
                    v-model="formData.file"
                />
            </div>
        </div>
        <VideoCompressParamForm ref="paramForm" />
        <div class="flex">
            <a-button class="mr-2" type="primary" @click="doSubmit">
                <icon-send class="mr-2" />
                {{ $t("common.submitTask") }}
            </a-button>
        </div>
    </div>
</template>
