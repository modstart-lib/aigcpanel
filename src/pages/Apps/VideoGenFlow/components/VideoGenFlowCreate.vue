<script setup lang="ts">
import { testActionSet, testActionUnset } from "@/utils/test";
import { onMounted, onUnmounted, ref, watch } from "vue";
import { t } from "../../../../lang";
import { Dialog } from "../../../../lib/dialog";
import { StorageUtil } from "../../../../lib/storage";
import { PermissionService } from "../../../../service/PermissionService";
import { TaskRecord, TaskService } from "../../../../service/TaskService";
import SoundGenerateForm from "../../../Video/components/SoundGenerateForm.vue";
import VideoGenForm from "../../../Video/components/VideoGenForm.vue";
import ModelAgentButton from "../../../../module/Model/ModelAgentButton.vue";
import {
    SoundGenerateTextFormItems,
    SoundGenerateTextPrompt,
} from "../../../Video/components/config/prompt";

const soundGenerateForm = ref<InstanceType<typeof SoundGenerateForm> | null>(
    null,
);
const videoGenForm = ref<InstanceType<typeof VideoGenForm> | null>(null);

const formData = ref({
    text: "",
});

onMounted(async () => {
    const old = StorageUtil.getObject("VideoGenFlowCreate.formData");
    formData.value.text = old.text || "";
    
});

onUnmounted(() => {
    
});

watch(
    () => formData.value,
    async (value) => {
        StorageUtil.set("VideoGenFlowCreate.formData", value);
    },
    {
        deep: true,
    },
);

const doSubmit = async () => {
    const videoGenValue = await videoGenForm.value?.getValue();
    if (!videoGenValue) {
        return;
    }
    let soundGenerateValue = await soundGenerateForm.value?.getValue();
    if (!soundGenerateValue) {
        return;
    }
    const record: TaskRecord = {
        biz: "VideoGenFlow",
        title: await $mapi.file.textToName(formData.value.text),
        serverName: videoGenValue.serverName,
        serverTitle: videoGenValue.serverTitle,
        serverVersion: videoGenValue.serverVersion,
        modelConfig: {
            videoTemplateId: videoGenValue.videoTemplateId,
            videoTemplateName: videoGenValue.videoTemplateName,
            videoTemplateUrl: videoGenValue.videoTemplateUrl,
            soundGenerate: soundGenerateValue,
            text: formData.value.text,
        },
        param: videoGenValue.param,
    };
    if (!(await PermissionService.checkForTask("VideoGenFlow", record))) {
        return;
    }
    // console.log('VideoGenFlow.submit',JSON.stringify(record))
    const id = await TaskService.submit(record);
    Dialog.tipSuccess(t("task.videoGenSubmitted"));
    formData.value.text = "";
    emit("submitted");
    return id;
};

const emit = defineEmits({
    submitted: () => true,
});
</script>

<template>
    <div class="rounded-xl shadow border p-4">
        <VideoGenForm ref="videoGenForm" />
        <SoundGenerateForm ref="soundGenerateForm" voice-select-only />
        <div class="mb-4">
            <a-textarea
                v-model="formData.text"
                :auto-size="{ minRows: 2 }"
                :placeholder="$t('app.inputVideoGenPlaceholder')"
            ></a-textarea>
            <!-- Place the copywriting action outside the textarea so it never covers the text -->
            <div class="flex justify-end mt-1">
                <ModelAgentButton
                    biz="VideoGenFlowTextPrompt"
                    :title="t('app.copywritingGenerate')"
                    @result="formData.text = $event"
                    :form-items="SoundGenerateTextFormItems"
                    :prompt-default="SoundGenerateTextPrompt"
                />
            </div>
        </div>
        <div>
            <a-button class="mr-2" type="primary" @click="doSubmit">
                {{ $t("task.startVideoGen") }}
            </a-button>
        </div>
    </div>
</template>
