<script setup lang="ts">
// 工作流选择器：显示平台功能（文生图/图生图等）下的可选工作流
import { computed } from "vue";

const props = defineProps<{
    workflows: any[];
    modelValue: string;
}>();

const emit = defineEmits<{
    "update:modelValue": [value: string];
}>();

const current = computed({
    get: () => props.modelValue,
    set: (v: string) => emit("update:modelValue", v),
});
</script>

<template>
    <a-select
        v-model="current"
        size="small"
        class="min-w-40"
        style="width: auto"
        :placeholder="$t('app.workflowSelect')"
    >
        <a-option v-for="wf in workflows" :key="wf.key" :value="wf.key">
            {{ wf.title }}
        </a-option>
    </a-select>
</template>
