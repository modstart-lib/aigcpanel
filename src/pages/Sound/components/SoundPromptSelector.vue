<script setup lang="ts">
import { onMounted, ref } from "vue";
import AudioPlayerButton from "../../../components/common/AudioPlayerButton.vue";
import { StorageRecord, StorageService } from "../../../service/StorageService";
import SoundPromptDialog from "./SoundPromptDialog.vue";

const soundPromptDialog = ref<InstanceType<typeof SoundPromptDialog>>();
const records = ref<StorageRecord[]>([]);
onMounted(async () => {
    await doRefresh();
});
const doRefresh = async () => {
    records.value = await StorageService.list("SoundPrompt");
};
const props = defineProps({
    modelValue: {
        type: Number,
        required: true,
        default: 0,
    },
    disabled: {
        type: Boolean,
        default: false,
    },
});
const emit = defineEmits(["update:modelValue"]);
const onSelect = (id: number) => {
    emit("update:modelValue", id);
};
const doSelect = () => {
    if (props.disabled) {
        return;
    }
    soundPromptDialog.value?.show();
};
</script>

<template>
    <div class="flex items-center">
        <div
            @click="doSelect()"
            class="mr-1 h-8 leading-8 px-3 rounded-lg cursor-pointer truncate bg-gray-100 hover:bg-gray-200 min-w-64"
            :class="disabled ? 'cursor-not-allowed bg-gray-50 hover:bg-gray-50 text-gray-400' : ''"
        >
            {{ records.find(s => s.id === props.modelValue)?.title || $t("hint.selectTimbre") }}
        </div>
        <AudioPlayerButton
            v-if="props.modelValue"
            class="mr-2 arco-btn arco-btn-secondary arco-btn-shape-square arco-btn-size-medium arco-btn-status-normal"
            :source="'file://' + records.find(s => s.id === props.modelValue)?.content?.url"
        />
    </div>
    <SoundPromptDialog ref="soundPromptDialog" @update="doRefresh" @select="onSelect"/>
</template>
