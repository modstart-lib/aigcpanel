<script setup lang="ts">
import { nextTick, ref } from "vue";
import ImageToImageForm from "../../common/ImageToImageForm.vue";

const imageToImageForm = ref<InstanceType<typeof ImageToImageForm> | null>(
    null,
);

const props = defineProps<{}>();

const visible = ref(false);
const emit = defineEmits<{
    update: [
        data: {
            imageToImage: TextToImageParamType;
        },
    ];
}>();
const doSubmit = async () => {
    const imageToImageValue = await imageToImageForm.value?.getValue();
    if (!imageToImageValue) {
        return;
    }
    visible.value = false;
    emit("update", {
        imageToImage: imageToImageValue,
    });
};

defineExpose({
    show: (data?: any) => {
        visible.value = true;
        nextTick(() => {
            if (data?.imageToImage) {
                imageToImageForm.value?.setValue(data.imageToImage);
            }
        });
    },
});
</script>

<template>
    <a-modal
        v-model:visible="visible"
        title-align="start"
        :title="$t('app.imageToImageSettings')"
        width="min(600px, 95vw)"
        :destroyOnClose="true"
    >
        <template #footer>
            <div class="flex justify-end space-x-2">
                <a-button @click="visible = false">{{
                    $t("common.cancel")
                }}</a-button>
                <a-button type="primary" @click="doSubmit">{{
                    $t("common.save")
                }}</a-button>
            </div>
        </template>
        <div v-if="visible" class="space-y-4">
            <ImageToImageForm ref="imageToImageForm" />
        </div>
    </a-modal>
</template>
