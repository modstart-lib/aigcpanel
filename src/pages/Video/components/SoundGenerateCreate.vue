<script setup lang="ts">
import { testActionSet, testActionUnset } from "@/utils/test";
import { onMounted, onUnmounted, ref } from "vue";
import BatchTextareaInputAction from "../../../components/BatchTextareaInputAction.vue";
import { t } from "../../../lang";
import { Dialog } from "../../../lib/dialog";
import { StorageUtil } from "../../../lib/storage";
import ModelAgentButton from "../../../module/Model/ModelAgentButton.vue";
import { PermissionService } from "../../../service/PermissionService";
import { TaskRecord, TaskService } from "../../../service/TaskService";
import {
    SoundGenerateTextFormItems,
    SoundGenerateTextPrompt,
} from "./config/prompt";
import SoundGenerateForm from "./SoundGenerateForm.vue";

const soundGenerateForm = ref<InstanceType<typeof SoundGenerateForm>>();
const formData = ref({
    text: "",
});

onMounted(async () => {
    const old = StorageUtil.getObject("SoundGenerateCreate.formData");
    formData.value.text = old.text || "";
    
});

onUnmounted(() => {
    
});

const doSubmit = async () => {
    const value = await soundGenerateForm.value?.getValue();
    if (!value) {
        return;
    }
    if (!formData.value.text) {
        Dialog.tipError(t("hint.inputSynthesisContent"));
        return;
    }
    const record: TaskRecord = {
        biz: "SoundGenerate",
        title: await window.$mapi.file.textToName(formData.value.text),
        serverName: value.serverName,
        serverTitle: value.serverTitle,
        serverVersion: value.serverVersion,
        modelConfig: {
            type: value.type,
            voiceId: value.voiceId,
            ttsServerKey: value.ttsServerKey,
            ttsParam: value.ttsParam,
            cloneServerKey: value.cloneServerKey,
            cloneParam: value.cloneParam,
            promptId: value.promptId,
            promptTitle: value.promptTitle,
            promptUrl: value.promptUrl,
            promptText: value.promptText,
            text: formData.value.text,
        },
    };
    if (!(await PermissionService.checkForTask(value.type, record))) {
        return;
    }
    const id = await TaskService.submit(record);
    formData.value.text = "";
    Dialog.tipSuccess(t("task.cloneSubmitted"));
    emit("submitted");
    return id;
};

const doSubmitBatch = async (records: { text: string }[]) => {
    const value = await soundGenerateForm.value?.getValue();
    if (!value) {
        return;
    }
    for (const r of records) {
        const record: TaskRecord = {
            biz: "SoundGenerate",
            title: await window.$mapi.file.textToName(r.text),
            serverName: value.serverName,
            serverTitle: value.serverTitle,
            serverVersion: value.serverVersion,
            modelConfig: {
                type: value.type,
                voiceId: value.voiceId,
                ttsServerKey: value.ttsServerKey,
                ttsParam: value.ttsParam,
                cloneServerKey: value.cloneServerKey,
                cloneParam: value.cloneParam,
                promptId: value.promptId,
                promptTitle: value.promptTitle,
                promptUrl: value.promptUrl,
                promptText: value.promptText,
                text: r.text,
            },
        };
        if (!(await PermissionService.checkForTask(value.type, record))) {
            return;
        }
        await TaskService.submit(record);
    }
    Dialog.tipSuccess(t("task.cloneSubmitted"));
    emit("submitted");
};

const emit = defineEmits({
    submitted: () => true,
});
</script>

<template>
    <div class="rounded-xl shadow border p-4">
        <SoundGenerateForm ref="soundGenerateForm" voice-select-only>
            <div class="mb-1 flex items-start w-full">
                <div class="pt-1 w-5 flex-shrink-0">
                    <a-tooltip :content="$t('hint.inputSynthesisContent')" mini>
                        <i-mdi-text-to-speech class="w-4 h-4" />
                    </a-tooltip>
                </div>
                <div class="flex-grow min-w-0">
                    <a-textarea
                        v-model="formData.text"
                        :auto-size="{ minRows: 2 }"
                        :placeholder="$t('hint.inputVoiceSynthesis')"
                    ></a-textarea>
                    <!-- Place the copywriting action outside the textarea so it never covers the text -->
                    <div class="flex justify-end mt-1">
                        <ModelAgentButton
                            biz="SoundGenerateTextPrompt"
                            :title="t('sound.copywritingGenerate')"
                            @result="formData.text = $event"
                            :form-items="SoundGenerateTextFormItems"
                            :prompt-default="SoundGenerateTextPrompt"
                        />
                    </div>
                </div>
            </div>
        </SoundGenerateForm>
        <div class="flex gap-1">
            <a-button class="mr-2" type="primary" @click="doSubmit">
                {{ $t("task.startSynthesis") }}
            </a-button>
            <BatchTextareaInputAction
                :text="$t('task.batchTextSynthesis')"
                :confirm-text="$t('task.submitSynthesis')"
                @submit="doSubmitBatch"
            />
        </div>
    </div>
</template>
