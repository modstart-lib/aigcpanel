<script setup lang="ts">
import { nextTick, ref } from "vue";
import ImageToVideoForm from "../../common/ImageToVideoForm.vue";

const imageToVideoForm = ref<InstanceType<typeof ImageToVideoForm> | null>(
    null,
);

const props = defineProps<{}>();

const visible = ref(false);
const emit = defineEmits<{
    update: [
        data: {
            imageToVideo: TextToImageParamType;
        },
    ];
}>();
const doSubmit = async () => {
    const imageToVideoValue = await imageToVideoForm.value?.getValue();
    if (!imageToVideoValue) {
        return;
    }
    visible.value = false;
    emit("update", {
        imageToVideo: imageToVideoValue,
    });
};

defineExpose({
    show: (data?: any) => {
        visible.value = true;
        nextTick(() => {
            if (data?.imageToVideo) {
                imageToVideoForm.value?.setValue(data.imageToVideo);
            }
        });
    },
});
</script>

<template>
    <a-modal
        v-model:visible="visible"
        title-align="start"
        :title="$t('app.imageToVideoSettings')"
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
            <ImageToVideoForm ref="imageToVideoForm" />
        </div>
    </a-modal>
</template>
