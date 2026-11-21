<script setup lang="ts">
import { nextTick, ref } from "vue";
import TextToImageForm from "../../common/TextToImageForm.vue";

const textToImageForm = ref<InstanceType<typeof TextToImageForm> | null>(null);

const props = defineProps<{}>();

const visible = ref(false);
const emit = defineEmits<{
    update: [
        data: {
            textToImage: TextToImageParamType;
        },
    ];
}>();
const doSubmit = async () => {
    const textToImageValue = await textToImageForm.value?.getValue();
    if (!textToImageValue) {
        return;
    }
    visible.value = false;
    emit("update", {
        textToImage: textToImageValue,
    });
};

defineExpose({
    show: (data?: any) => {
        visible.value = true;
        nextTick(() => {
            if (data?.textToImage) {
                textToImageForm.value?.setValue(data.textToImage);
            }
        });
    },
});
</script>

<template>
    <a-modal
        v-model:visible="visible"
        title-align="start"
        :title="$t('app.textToImageSettings')"
        width="min(600px, 95vw)"
        :destroyOnClose="true"
    >
        <template #footer>
            <div class="flex justify-end space-x-2">
                <a-button type="primary" @click="doSubmit">{{
                    $t("common.save")
                }}</a-button>
            </div>
        </template>
        <div v-if="visible" class="space-y-4">
            <TextToImageForm ref="textToImageForm" />
        </div>
    </a-modal>
</template>
