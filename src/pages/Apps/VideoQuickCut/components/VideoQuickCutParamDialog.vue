<script setup lang="ts">
import { nextTick, ref } from "vue";
import VideoQuickCutParamForm from "./VideoQuickCutParamForm.vue";

const paramForm = ref<InstanceType<typeof VideoQuickCutParamForm>>();

const visible = ref(false);
const emit = defineEmits<{
    update: [
        data: {
            soundAsr: SoundAsrParamType;
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
        soundAsr: value.soundAsr,
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
            <VideoQuickCutParamForm ref="paramForm" />
        </div>
    </a-modal>
</template>
