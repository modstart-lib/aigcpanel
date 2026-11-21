<script setup lang="ts">
import { testActionSet, testActionUnset } from "@/utils/test";
import { onMounted, onUnmounted, ref } from "vue";
import ImagesSelector from "../../../../components/common/ImagesSelector.vue";
import { dataAutoSaveDraft } from "../../../../components/common/util";
import { t } from "../../../../lang";
import { Dialog } from "../../../../lib/dialog";
import { TaskRecord, TaskService } from "../../../../service/TaskService";
import ImageToVideoForm from "../../common/ImageToVideoForm.vue";

const emit = defineEmits<{
    submitted: [];
}>();
const imageToVideoForm = ref<InstanceType<typeof ImageToVideoForm>>();
const formData = ref({
    images: [] as string[],
    prompt: "",
});
const { clearDraft } = dataAutoSaveDraft(
    "ImageToVideoCreate.formData",
    formData.value,
);

onMounted(() => {
    
});

onUnmounted(() => {
    
});

const doSubmit = async () => {
    const imageToVideoValue = await imageToVideoForm.value?.getValue();
    if (!imageToVideoValue) {
        return;
    }
    if (!formData.value.images.length) {
        Dialog.tipError(t("error.pleaseSelectImage"));
        return;
    }
    for (const image of formData.value.images) {
        if (!(await $mapi.file.exists(image))) {
            Dialog.tipError(t("error.imageFileNotSelected"));
            return;
        }
    }
    if (!formData.value.prompt.trim()) {
        Dialog.tipError(t("error.pleaseInputPrompt"));
        return;
    }
    const taskTitle = formData.value.prompt.substring(0, 20) + "...";
    const record: TaskRecord = {
        biz: "ImageToVideo",
        title: taskTitle,
        serverName: "",
        serverTitle: "",
        serverVersion: "",
        modelConfig: {
            images: formData.value.images,
            prompt: formData.value.prompt,
            imageToVideo: imageToVideoValue,
        },
        param: {},
    };
    const id = await TaskService.submit(record);
    formData.value.images = [];
    formData.value.prompt = "";
    emit("submitted");
    Dialog.tipSuccess(t("common.taskSubmitted"));
    clearDraft();
    return id;
};
</script>

<template>
    <div class="rounded-xl shadow border p-4">
        <ImageToVideoForm ref="imageToVideoForm">
            <div class="w-full flex flex-col gap-2">
                <div class="flex items-start w-full">
                    <div class="pt-1 w-5 flex-shrink-0">
                        <a-tooltip :content="$t('hint.inputInputImage')" mini>
                            <icon-image />
                        </a-tooltip>
                    </div>
                    <div class="flex-grow min-w-0">
                        <ImagesSelector v-model="formData.images" />
                    </div>
                </div>
                <div class="flex items-start w-full">
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
            </div>
        </ImageToVideoForm>
        <div class="flex">
            <a-button class="mr-2" type="primary" @click="doSubmit">
                <i-mdi-send class="mr-2" />
                {{ $t("soundReplace.submitTask") }}
            </a-button>
        </div>
    </div>
</template>
