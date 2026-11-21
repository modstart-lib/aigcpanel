<script setup lang="ts">
import { testActionSet, testActionUnset } from "@/utils/test";
import { onMounted, onUnmounted, ref } from "vue";
import { dataAutoSaveDraft } from "../../../../components/common/util";
import { t } from "../../../../lang";
import { Dialog } from "../../../../lib/dialog";
import { TaskRecord, TaskService } from "../../../../service/TaskService";
import TextToImageForm from "../../common/TextToImageForm.vue";

const emit = defineEmits<{
    submitted: [];
}>();
const textToImageForm = ref<InstanceType<typeof TextToImageForm>>();
const formData = ref({
    prompt: "",
});
const { clearDraft } = dataAutoSaveDraft(
    "TextToImageCreate.formData",
    formData.value,
);

onMounted(() => {
    
});

onUnmounted(() => {
    
});

const doSubmit = async () => {
    const textToImageValue = await textToImageForm.value?.getValue();
    if (!textToImageValue) {
        return;
    }
    if (!formData.value.prompt.trim()) {
        Dialog.tipError(t("error.pleaseInputText"));
        return;
    }
    const taskTitle = formData.value.prompt.substring(0, 20) + "...";
    const record: TaskRecord = {
        biz: "TextToImage",
        title: taskTitle,
        serverName: "",
        serverTitle: "",
        serverVersion: "",
        modelConfig: {
            prompt: formData.value.prompt,
            textToImage: textToImageValue,
        },
        param: {},
    };
    const id = await TaskService.submit(record);
    formData.value.prompt = "";
    emit("submitted");
    Dialog.tipSuccess(t("common.taskSubmitted"));
    clearDraft();
    return id;
};
</script>

<template>
    <div class="rounded-xl shadow border p-4">
        <TextToImageForm ref="textToImageForm">
            <div class="mb-1 flex items-start w-full">
                <div class="pt-1 w-5 flex-shrink-0">
                    <a-tooltip :content="$t('hint.inputPrompt')" mini>
                        <i-mdi-text-box-outline class="w-4 h-4" />
                    </a-tooltip>
                </div>
                <div class="flex-grow min-w-0">
                    <a-textarea
                        v-model="formData.prompt"
                        :placeholder="$t('hint.inputPrompt')"
                        :auto-size="{ minRows: 2, maxRows: 10 }"
                    />
                </div>
            </div>
        </TextToImageForm>
        <div class="flex">
            <a-button class="mr-2" type="primary" @click="doSubmit">
                <i-mdi-send class="mr-2" />
                {{ $t("soundReplace.submitTask") }}
            </a-button>
        </div>
    </div>
</template>
