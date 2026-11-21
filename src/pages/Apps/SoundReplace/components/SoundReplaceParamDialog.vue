<script setup lang="ts">
import { nextTick, ref } from "vue";
import SoundAsrForm from "../../../Video/components/SoundAsrForm.vue";
import SoundGenerateForm from "../../../Video/components/SoundGenerateForm.vue";

const soundAsrForm = ref<InstanceType<typeof SoundAsrForm>>();
const soundGenerateForm = ref<InstanceType<typeof SoundGenerateForm> | null>(
    null,
);

const props = defineProps<{}>();

const visible = ref(false);
const emit = defineEmits<{
    update: [
        data: {
            soundAsr: SoundAsrParamType;
            soundGenerate: SoundGenerateParamType;
        },
    ];
}>();
const doSubmit = async () => {
    const soundAsrValue = await soundAsrForm.value?.getValue();
    if (!soundAsrValue) {
        return;
    }
    const soundGenerateValue = await soundGenerateForm.value?.getValue();
    if (!soundGenerateValue) {
        return;
    }
    visible.value = false;
    emit("update", {
        soundAsr: soundAsrValue,
        soundGenerate: soundGenerateValue,
    });
};

defineExpose({
    show: (data?: any) => {
        visible.value = true;
        nextTick(() => {
            if (data?.soundAsr) {
                soundAsrForm.value?.setValue(data.soundAsr);
            }
            if (data?.soundGenerate) {
                soundGenerateForm.value?.setValue(data.soundGenerate);
            }
        });
    },
});
</script>

<template>
    <a-modal
        v-model:visible="visible"
        title-align="start"
        :title="$t('voice.replaceConfig')"
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
            <SoundAsrForm ref="soundAsrForm" />
            <SoundGenerateForm ref="soundGenerateForm" />
        </div>
    </a-modal>
</template>
