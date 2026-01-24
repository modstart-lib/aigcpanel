<script setup lang="ts">
import { ref, watch } from "vue";
import AudioPlayerButton from "../../../components/common/AudioPlayerButton.vue";
import { TaskRecord } from "../../../service/TaskService";
import SoundGenerateDialog from "./SoundGenerateDialog.vue";

const soundGenerateDialog = ref<InstanceType<typeof SoundGenerateDialog> | null>(null);
const props = defineProps({
    modelValue: {
        type: Number,
        required: true,
        default: 0,
    },
});
const soundId = ref(0);
const soundTitle = ref("");
const soundUrl = ref("");
const emit = defineEmits(["update:modelValue"]);
const onSelect = (record: TaskRecord | null) => {
    if (record) {
        soundId.value = record.id as number;
        soundTitle.value = record.title;
        soundUrl.value = record.result?.url || "";
    } else {
        soundId.value = 0;
        soundTitle.value = "";
        soundUrl.value = "";
    }
    emit("update:modelValue", record ? record.id : 0);
};
watch(
    () => props.modelValue,
    value => {
        if (value > 0 && soundId.value !== value) {
            soundGenerateDialog.value?.load(value).then(onSelect);
        }
    },
    {
        immediate: true,
    }
);
</script>

<template>
    <div class="flex items-center">
        <div
            @click="soundGenerateDialog?.show()"
            class="w-96 mr-2 h-8 leading-8 px-3 rounded-lg cursor-pointer truncate bg-gray-100 hover:bg-gray-200"
        >
            {{ soundTitle || $t("hint.selectVoice") }}
        </div>
        <AudioPlayerButton
            v-if="soundUrl"
            class="mr-2 arco-btn arco-btn-secondary arco-btn-shape-square arco-btn-size-medium arco-btn-status-normal"
            :source="'file://' + soundUrl"
        />
    </div>
    <SoundGenerateDialog ref="soundGenerateDialog" @select="onSelect" />
</template>
