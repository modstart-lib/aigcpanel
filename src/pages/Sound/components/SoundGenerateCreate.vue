<script setup lang="ts">
import {onMounted, ref} from "vue";
import {StorageUtil} from "../../../lib/storage";
import SoundGenerateForm from "./SoundGenerateForm.vue";
import BatchTextareaInputAction from "../../../components/BatchTextareaInputAction.vue";
import {Dialog} from "../../../lib/dialog";
import {t} from "../../../lang";
import {TaskRecord, TaskService} from "../../../service/TaskService";
import {PermissionService} from "../../../service/PermissionService";
import ModelAgentButton from "../../../module/Model/ModelAgentButton.vue";
import {SoundGenerateTextFormItems, SoundGenerateTextPrompt} from "../config/prompt";

const soundGenerateForm = ref<InstanceType<typeof SoundGenerateForm>>();
const formData = ref({
    text: "",
});

onMounted(async () => {
    const old = StorageUtil.getObject("SoundGenerateCreate.formData");
    formData.value.text = old.text || "";
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
        <div class="mb-1">
            <a-textarea
                v-model="formData.text"
                :auto-size="{minRows: 2}"
                :placeholder="$t('hint.inputVoiceSynthesis')"
            ></a-textarea>
        </div>
        <div class="mb-2 flex gap-1">
            <ModelAgentButton biz="SoundGenerateTextPrompt"
                              @result="formData.text = $event"
                              :form-items="SoundGenerateTextFormItems"
                              :prompt-default="SoundGenerateTextPrompt"/>
        </div>
        <SoundGenerateForm ref="soundGenerateForm"/>
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
