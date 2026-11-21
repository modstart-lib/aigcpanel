<script setup lang="ts">
import { testActionSet, testActionUnset } from "@/utils/test";
import { onMounted, onUnmounted, ref } from "vue";
import { dataAutoSaveDraft } from "../../../../components/common/util";
import { t } from "../../../../lang";
import { Dialog } from "../../../../lib/dialog";
import { TaskRecord, TaskService } from "../../../../service/TaskService";
import SoundGenerateForm from "../../../Video/components/SoundGenerateForm.vue";

const emit = defineEmits<{
    submitted: [];
}>();
const soundGenerateForm = ref<InstanceType<typeof SoundGenerateForm>>();
const formData = ref({
    text: "",
});
const { clearDraft } = dataAutoSaveDraft(
    "LongTextTtsCreate.formData",
    formData.value,
);

onMounted(() => {
    
});

onUnmounted(() => {
    
});

const doSubmit = async () => {
    const soundGenerateValue = await soundGenerateForm.value?.getValue();
    if (!soundGenerateValue) {
        return;
    }
    if (!formData.value.text.trim()) {
        Dialog.tipError(t("app.inputLongText"));
        return;
    }
    const taskTitle = formData.value.text.substring(0, 20) + "...";
    const record: TaskRecord = {
        biz: "LongTextTts",
        title: taskTitle,
        serverName: "",
        serverTitle: "",
        serverVersion: "",
        modelConfig: {
            text: formData.value.text,
            soundGenerate: soundGenerateValue,
        },
        param: {},
    };
    const id = await TaskService.submit(record);
    formData.value.text = "";
    emit("submitted");
    Dialog.tipSuccess(t("common.taskSubmitted"));
    clearDraft();
    return id;
};
</script>

<template>
    <div class="rounded-xl shadow border p-4">
        <SoundGenerateForm ref="soundGenerateForm" />
        <div class="mb-4 flex items-start w-full">
            <div class="pt-1 w-5 flex-shrink-0">
                <a-tooltip :content="$t('app.longTextLabel')" mini>
                    <i-mdi-text-long class="w-4 h-4" />
                </a-tooltip>
            </div>
            <div class="flex-grow min-w-0">
                <div class="mb-2 font-bold">{{ $t("app.longTextLabel") }}</div>
                <a-textarea
                    v-model="formData.text"
                    :placeholder="$t('app.inputLongTextPlaceholder')"
                    :auto-size="{ minRows: 6, maxRows: 20 }"
                />
            </div>
        </div>
        <div class="flex">
            <a-button class="mr-2" type="primary" @click="doSubmit">
                <i-mdi-send class="mr-2" />
                {{ $t("soundReplace.submitTask") }}
            </a-button>
        </div>
    </div>
</template>
