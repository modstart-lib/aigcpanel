<script setup lang="ts">
import { nextTick, ref } from "vue";
import SoundGenerateForm from "../../../Video/components/SoundGenerateForm.vue";

const soundGenerateForm = ref<InstanceType<typeof SoundGenerateForm> | null>(
    null,
);

const props = defineProps<{}>();

const visible = ref(false);
const emit = defineEmits<{
    update: [
        data: {
            soundGenerate: SoundGenerateParamType;
        },
    ];
}>();
const doSubmit = async () => {
    const soundGenerateValue = await soundGenerateForm.value?.getValue();
    if (!soundGenerateValue) {
        return;
    }
    visible.value = false;
    emit("update", {
        soundGenerate: soundGenerateValue,
    });
};

defineExpose({
    show: (data?: any) => {
        visible.value = true;
        nextTick(() => {
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
        :title="$t('subtitleTts.settings')"
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
            <SoundGenerateForm ref="soundGenerateForm" />
        </div>
    </a-modal>
</template>
