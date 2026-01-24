<script setup lang="ts">
import { ref } from "vue";
import FileSelector from "../../../../components/common/FileSelector.vue";
import { dataAutoSaveDraft } from "../../../../components/common/util";
import { t } from "../../../../lang";
import { Dialog } from "../../../../lib/dialog";
import { TaskRecord, TaskService } from "../../../../service/TaskService";
import SoundAsrForm from "../../../Sound/components/SoundAsrForm.vue";
import SoundGenerateForm from "../../../Sound/components/SoundGenerateForm.vue";

const emit = defineEmits<{
    submitted: [];
}>();
const soundAsrForm = ref<InstanceType<typeof SoundAsrForm>>();
const soundGenerateForm = ref<InstanceType<typeof SoundGenerateForm> | null>(null);
const formData = ref({
    video: "",
});
const {clearDraft} = dataAutoSaveDraft("SoundReplaceCreate.formData", formData.value);

const doSubmit = async () => {
    const soundAsrValue = await soundAsrForm.value?.getValue();
    if (!soundAsrValue) {
        return;
    }
    const soundGenerateValue = await soundGenerateForm.value?.getValue();
    if (!soundGenerateValue) {
        return;
    }
    if (!formData.value.video) {
        Dialog.tipError(t("hint.selectVideoFile"));
        return;
    }
    const taskTitle = $mapi.file.pathToName(formData.value.video, false);
    const record: TaskRecord = {
        biz: "SoundReplace",
        title: taskTitle,
        serverName: "",
        serverTitle: "",
        serverVersion: "",
        modelConfig: {
            video: formData.value.video,
            soundAsr: soundAsrValue,
            soundGenerate: soundGenerateValue,
        },
        param: {},
    };
    await TaskService.submit(record);
    formData.value.video = "";
    emit("submitted");
    Dialog.tipSuccess(t("soundReplace.taskSubmitted"));
    clearDraft();
};
</script>

<template>
    <div class="rounded-xl shadow border p-4">
        <div class="mb-4 flex items-start">
            <div class="pt-1 w-5">
                <a-tooltip :content="$t('media.video')" mini>
                    <i class="iconfont icon-video"></i>
                </a-tooltip>
            </div>
            <div class="flex items-center gap-2">
                <FileSelector :extensions="['mp4']" v-model="formData.video"/>
            </div>
        </div>
        <SoundAsrForm ref="soundAsrForm"/>
        <SoundGenerateForm ref="soundGenerateForm"/>
        <div class="flex">
            <a-button class="mr-2" type="primary" @click="doSubmit">
                <i class="iconfont icon-submit mr-2"></i>
                {{ $t("soundReplace.submitTask") }}
            </a-button>
        </div>
    </div>
</template>
