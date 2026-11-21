<script setup lang="ts">
import { nextTick, ref } from "vue";
import VideoSizeConvertParamForm from "./VideoSizeConvertParamForm.vue";

const paramForm = ref<InstanceType<typeof VideoSizeConvertParamForm>>();

const props = defineProps<{}>();

const visible = ref(false);
const emit = defineEmits<{
    update: [
        data: {
            targetWidth: number;
            targetHeight: number;
            fillMode: "blur" | "black" | "crop" | "stretch";
        },
    ];
}>();
const doSubmit = async () => {
    const value = await paramForm.value?.getValue();
    if (!value) {
        return;
    }
    visible.value = false;
    emit("update", {
        targetWidth: value.targetWidth,
        targetHeight: value.targetHeight,
        fillMode: value.fillMode,
    });
};

defineExpose({
    show: (data?: any) => {
        visible.value = true;
        nextTick(() => {
            if (data) {
                paramForm.value?.setValue(data);
            }
        });
    },
});
</script>

<template>
    <a-modal
        v-model:visible="visible"
        title-align="start"
        :title="$t('common.setting2')"
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
            <VideoSizeConvertParamForm ref="paramForm" />
        </div>
    </a-modal>
</template>
