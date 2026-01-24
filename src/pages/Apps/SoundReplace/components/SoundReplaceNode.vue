<script setup lang="ts">
import {ref} from "vue";
import SoundAsrForm from "../../../Sound/components/SoundAsrForm.vue";
import SoundGenerateForm from "../../../Sound/components/SoundGenerateForm.vue";
import SoundGenerateFormView from "../../../Sound/components/SoundGenerateFormView.vue";
import SoundAsrFormView from "../../../Sound/components/SoundAsrFormView.vue";

const props = defineProps<{
    node: any;
    data: any;
}>();

const emit = defineEmits<{
    change: [data: any];
}>();

const visible = ref(false);
const soundAsrForm = ref<InstanceType<typeof SoundAsrForm>>();
const soundGenerateForm = ref<InstanceType<typeof SoundGenerateForm> | null>(null);
const doSubmit = async () => {
    const soundAsrValue = await soundAsrForm.value?.getValue();
    if (!soundAsrValue) {
        return;
    }
    const soundGenerateValue = await soundGenerateForm.value?.getValue();
    if (!soundGenerateValue) {
        return;
    }
    const newData = {
        ...props.data,
        soundAsr: soundAsrValue,
        soundGenerate: soundGenerateValue,
    };
    emit("change", newData);
    visible.value = false;
};
</script>

<template>
    <div class="p-2 relative">
        <SoundAsrFormView v-if="data.soundAsr" :data="data.soundAsr"/>
        <SoundGenerateFormView v-if="data.soundGenerate" :data="data.soundGenerate"/>
        <div
            v-if="!data.soundAsr && !data.soundGenerate"
            @click="visible = true"
            class="p-2 text-center text-xs text-gray-500 rounded-lg bg-gray-100 cursor-pointer">
            {{ $t("common.clickToConfig") }}
        </div>
        <div v-else class="mt-2">
            <a-button size="mini" @click="visible = true">{{ $t("common.modify") }}</a-button>
        </div>
    </div>
    <a-modal
        v-model:visible="visible"
        title-align="start"
        :title="$t('voice.replaceConfig')"
        width="600px"
        :destroyOnClose="true"
    >
        <template #footer>
            <div class="flex justify-end space-x-2">
                <a-button type="primary" @click="doSubmit">{{ $t("common.save") }}</a-button>
            </div>
        </template>
        <div v-if="visible" class="space-y-4 overflow-y-auto" style="max-height: calc(100vh - 10rem)">
            <SoundAsrForm ref="soundAsrForm"/>
            <SoundGenerateForm ref="soundGenerateForm"/>
        </div>
    </a-modal>
</template>
