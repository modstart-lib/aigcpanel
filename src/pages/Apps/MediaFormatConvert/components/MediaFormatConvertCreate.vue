<script setup lang="ts">
import { testActionSet, testActionUnset } from "@/utils/test";
import { onMounted, onUnmounted, ref } from "vue";
import FileSelector from "../../../../components/common/FileSelector.vue";
import { dataAutoSaveDraft } from "../../../../components/common/util";
import { t } from "../../../../lang";
import { Dialog } from "../../../../lib/dialog";
import { TaskRecord, TaskService } from "../../../../service/TaskService";
import MediaFormatConvertParamForm from "./MediaFormatConvertParamForm.vue";

const emit = defineEmits<{
    submitted: [];
}>();

const paramForm = ref<InstanceType<typeof MediaFormatConvertParamForm> | null>(
    null,
);

const formData = ref({
    media: "",
});

const { clearDraft } = dataAutoSaveDraft(
    "MediaFormatConvertCreate.formData",
    formData.value,
);

const doSubmit = async () => {
    const mediaFormatConvertValue = await paramForm.value?.getValue();
    if (!mediaFormatConvertValue) {
        return;
    }
    if (!formData.value.media) {
        Dialog.tipError(t("error.selectMediaFile"));
        return;
    }

    const taskTitle = $mapi.file.pathToName(formData.value.media, false);
    const record: TaskRecord = {
        biz: "MediaFormatConvert",
        title: taskTitle,
        serverName: "",
        serverTitle: "",
        serverVersion: "",
        modelConfig: {
            media: formData.value.media,
            ...mediaFormatConvertValue,
        },
        param: {},
    };
    const id = await TaskService.submit(record);
    formData.value.media = "";
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
                <a-tooltip :content="t('app.mediaFile')" mini>
                    <icon-file />
                </a-tooltip>
            </div>
            <div class="flex items-center gap-2">
                <FileSelector
                    :extensions="[
                        'mp4',
                        'mp3',
                        'wav',
                        'mov',
                        'avi',
                        'mkv',
                        'flac',
                        'ogg',
                        'aac',
                    ]"
                    v-model="formData.media"
                />
            </div>
        </div>
        <MediaFormatConvertParamForm ref="paramForm" />
        <div class="flex">
            <a-button class="mr-2" type="primary" @click="doSubmit">
                <icon-send class="mr-2" />
                {{ $t("common.submitTask") }}
            </a-button>
        </div>
    </div>
</template>
