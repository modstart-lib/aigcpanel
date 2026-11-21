<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
    VideoTemplateRecord,
    VideoTemplateService,
} from "../../../service/VideoTemplateService";

defineProps<{ modelValue: number }>();
const emit = defineEmits<{ "update:modelValue": [value: number] }>();

const records = ref<VideoTemplateRecord[]>([]);
onMounted(async () => {
    records.value = await VideoTemplateService.list();
});
</script>

<template>
    <a-select
        :model-value="modelValue || undefined"
        allow-search
        @change="emit('update:modelValue', $event as number)"
    >
        <a-option :value="0">
            {{ $t("hint.selectAvatar") }}
        </a-option>
        <a-option v-for="record in records" :key="record.id" :value="record.id">
            {{ record.name }}
        </a-option>
    </a-select>
</template>
