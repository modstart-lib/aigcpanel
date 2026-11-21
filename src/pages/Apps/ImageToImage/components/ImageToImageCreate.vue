<script setup lang="ts">
import { testActionSet, testActionUnset } from "@/utils/test";
import { onMounted, onUnmounted, ref } from "vue";
import FileSelector from "../../../../components/common/FileSelector.vue";
import ImagePreviewBox from "../../../../components/common/ImagePreviewBox.vue";
import { dataAutoSaveDraft } from "../../../../components/common/util";
import { t } from "../../../../lang";
import { Dialog } from "../../../../lib/dialog";
import { TaskRecord, TaskService } from "../../../../service/TaskService";
import ImageToImageForm from "../../common/ImageToImageForm.vue";

const emit = defineEmits<{
    submitted: [];
}>();
const imageToImageForm = ref<InstanceType<typeof ImageToImageForm>>();
const formData = ref({
    image: "",
    prompt: "",
});
const { clearDraft } = dataAutoSaveDraft(
    "ImageToImageCreate.formData",
    formData.value,
);

onMounted(() => {
    
});

onUnmounted(() => {
    
});

const doSubmit = async () => {
    const imageToImageValue = await imageToImageForm.value?.getValue();
    if (!imageToImageValue) {
        return;
    }
    if (!formData.value.image) {
        Dialog.tipError(t("error.pleaseSelectImage"));
        return;
    }
    if (!(await $mapi.file.exists(formData.value.image))) {
        Dialog.tipError(t("error.imageFileNotSelected"));
        return;
    }
    if (!formData.value.prompt.trim()) {
        Dialog.tipError(t("error.pleaseInputPrompt"));
        return;
    }
    const taskTitle = formData.value.prompt.substring(0, 20) + "...";
    const record: TaskRecord = {
        biz: "ImageToImage",
        title: taskTitle,
        serverName: "",
        serverTitle: "",
        serverVersion: "",
        modelConfig: {
            image: formData.value.image,
            prompt: formData.value.prompt,
            imageToImage: imageToImageValue,
        },
        param: {},
    };
    const id = await TaskService.submit(record);
    formData.value.image = "";
    formData.value.prompt = "";
    emit("submitted");
    Dialog.tipSuccess(t("common.taskSubmitted"));
    clearDraft();
    return id;
};
</script>

<template>
    <div class="rounded-xl shadow border p-4">
        <ImageToImageForm ref="imageToImageForm">
            <div class="w-full flex flex-col gap-2">
                <div class="flex items-start w-full">
                    <div class="pt-1 w-5 flex-shrink-0">
                        <a-tooltip :content="$t('hint.inputInputImage')" mini>
                            <icon-image />
                        </a-tooltip>
                    </div>
                    <div class="flex-grow min-w-0">
                        <div class="flex items-center gap-2">
                            <FileSelector
                                :extensions="['png', 'jpg', 'jpeg']"
                                v-model="formData.image"
                            />
                        </div>
                        <div v-if="formData.image" class="mt-2">
                            <ImagePreviewBox :url="formData.image" />
                        </div>
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
        </ImageToImageForm>
        <div class="flex">
            <a-button class="mr-2" type="primary" @click="doSubmit">
                <i-mdi-send class="mr-2" />
                {{ $t("soundReplace.submitTask") }}
            </a-button>
        </div>
    </div>
</template>
