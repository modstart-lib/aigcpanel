<script setup lang="ts">
import { nextTick, ref } from "vue";
import TextToVideoForm from "../../common/TextToVideoForm.vue";

const textToVideoForm = ref<InstanceType<typeof TextToVideoForm> | null>(null);

const props = defineProps<{}>();

const visible = ref(false);
const emit = defineEmits<{
    update: [
        data: {
            textToVideo: TextToVideoParamType;
        },
    ];
}>();
const doSubmit = async () => {
    const textToVideoValue = await textToVideoForm.value?.getValue();
    if (!textToVideoValue) {
        return;
    }
    visible.value = false;
    emit("update", {
        textToVideo: textToVideoValue,
    });
};

defineExpose({
    show: (data?: any) => {
        visible.value = true;
        nextTick(() => {
            if (data?.textToVideo) {
                textToVideoForm.value?.setValue(data.textToVideo);
            }
        });
    },
});
</script>

<template>
    <a-modal
        v-model:visible="visible"
        title-align="start"
        :title="$t('app.textToVideoSettings')"
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
            <TextToVideoForm ref="textToVideoForm" />
        </div>
    </a-modal>
</template>
