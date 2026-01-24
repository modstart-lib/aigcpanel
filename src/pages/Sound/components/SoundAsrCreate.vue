<script setup lang="ts">
import {ref} from "vue";
import {t} from "../../../lang";
import {Dialog} from "../../../lib/dialog";
import {PermissionService} from "../../../service/PermissionService";
import {TaskRecord, TaskService} from "../../../service/TaskService";
import SoundAsrForm from "./SoundAsrForm.vue";
import FileSelector from "../../../components/common/FileSelector.vue";

const emit = defineEmits<{
    submitted: [];
}>();

const soundAsrForm = ref<InstanceType<typeof SoundAsrForm>>();
const formData = ref({
    audio: "",
});

const onSelectAudioFile = async () => {
    try {
        const filePath = await window.$mapi.file.openFile({
            title: t("media.selectAudio"),
            filters: [{name: t("media.audioFile"), extensions: ["mp3", "wav"]}],
        });

        if (filePath) {
            formData.value.audio = filePath;
        }
    } catch (error) {
        Dialog.tipError(t("error.fileSelectFailed"));
    }
};

const doSubmit = async () => {
    if (isSubmitting.value) return;
    isSubmitting.value = true;

    try {
        const value = await soundAsrForm.value?.getValue();
        if (!value) {
            return;
        }

        if (!formData.value.audio) {
            Dialog.tipError(t("hint.selectAudioFile"));
            return;
        }

        // Generate task title from audio filename
        const taskTitle = window.$mapi.file.pathToName(formData.value.audio, false);

        const record: TaskRecord = {
            biz: "SoundAsr",
            title: taskTitle,
            serverName: value.serverName,
            serverTitle: value.serverTitle,
            serverVersion: value.serverVersion,
            modelConfig: {
                type: value.type,
                serverKey: value.serverKey,
                param: value.param,
                audio: formData.value.audio,
            },
            param: {},
        };

        if (!(await PermissionService.checkForTask(value.type, record))) {
            return;
        }

        await TaskService.submit(record);

        // Reset form
        formData.value.audio = "";

        emit("submitted");
        Dialog.tipSuccess(t("task.recognitionSubmitted"));
    } finally {
        isSubmitting.value = false;
    }
};

const isSubmitting = ref(false);
</script>

<template>
    <div class="rounded-xl shadow border p-4">
        <div class="mb-4 flex items-start">
            <div class="mr-1 pt-1">
                <a-tooltip :content="$t('voice.file')" mini>
                    <i class="iconfont icon-sound"></i>
                </a-tooltip>
            </div>
            <div>
                <FileSelector :extensions="['mp3', 'wav']" v-model="formData.audio" />
            </div>
        </div>
        <SoundAsrForm ref="soundAsrForm" />
        <div class="flex">
            <a-button class="mr-2" type="primary" @click="doSubmit" :loading="isSubmitting">
                <i class="iconfont icon-submit mr-2"></i>
                {{ t("task.startRecognition") }}
            </a-button>
        </div>
    </div>
</template>
