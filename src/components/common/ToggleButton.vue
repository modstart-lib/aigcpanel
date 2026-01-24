<script setup lang="ts">
const props = defineProps<{
    modelValue: boolean;
    text?: string;
}>();
const emits = defineEmits<{
    (e: "update:modelValue", value: boolean): void;
}>();
</script>

<template>
    <a-button @click="emits('update:modelValue',!modelValue)" size="small" class="ml-2">
        <template #icon>
            <icon-up v-if="!modelValue"/>
            <icon-down v-else/>
        </template>
        {{ text || $t("common.description") }}
    </a-button>
</template>

