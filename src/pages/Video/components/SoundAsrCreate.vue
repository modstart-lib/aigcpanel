<script setup lang="ts">
import { testActionSet, testActionUnset } from "@/utils/test";
import { onMounted, onUnmounted, ref } from "vue";
import FileSelector from "../../../components/common/FileSelector.vue";
import { t } from "../../../lang";
import { Dialog } from "../../../lib/dialog";
import { PermissionService } from "../../../service/PermissionService";
import { TaskRecord, TaskService } from "../../../service/TaskService";
import SoundAsrForm from "./SoundAsrForm.vue";

const emit = defineEmits<{
    submitted: [];
}>();

const soundAsrForm = ref<InstanceType<typeof SoundAsrForm>>();
const formData = ref({
    audio: "",
});

onMounted(() => {
    
});

onUnmounted(() => {
    
});

const onSelectAudioFile = async () => {
    try {
        const filePath = await window.$mapi.file.openFile({
            title: t("media.selectAudio"),
            filters: [
                { name: t("media.audioFile"), extensions: ["mp3", "wav"] },
            ],
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
        if (!(await window.$mapi.file.exists(formData.value.audio))) {
            Dialog.tipError(t("error.audioFileNotSelected"));
            return;
        }

        // Generate task title from audio filename
        const taskTitle = window.$mapi.file.pathToName(
            formData.value.audio,
            false,
        );

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

        const id = await TaskService.submit(record);

        // Reset form
        formData.value.audio = "";

        emit("submitted");
        Dialog.tipSuccess(t("task.recognitionSubmitted"));
        return id;
    } finally {
        isSubmitting.value = false;
    }
};

const isSubmitting = ref(false);
</script>

<template>
    <div class="rounded-xl shadow border p-4">
        <SoundAsrForm ref="soundAsrForm">
            <div class="flex items-start">
                <div class="mr-1 pt-1">
                    <a-tooltip :content="$t('voice.file')" mini>
                        <i-mdi-volume-high class="w-4 h-4" />
                    </a-tooltip>
                </div>
                <div>
                    <FileSelector
                        :extensions="['mp3', 'wav']"
                        v-model="formData.audio"
                    />
                </div>
            </div>
        </SoundAsrForm>
        <div class="flex">
            <a-button
                class="mr-2"
                type="primary"
                @click="doSubmit"
                :loading="isSubmitting"
            >
                <i-mdi-send class="mr-2" />
                {{ t("task.startRecognition") }}
            </a-button>
        </div>
    </div>
</template>
