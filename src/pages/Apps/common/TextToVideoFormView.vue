<script setup lang="ts">
import TextToVideoFormViewBody from "./TextToVideoFormViewBody.vue";

const props = defineProps<{
    data: any;
}>();

defineExpose({});
</script>

<template>
    <div class="mb-1">
        <div class="font-bold mb-2">{{ $t("app.textToVideoConfig") }}</div>
        <div class="flex gap-1 flex-wrap">
            <TextToVideoFormViewBody :data="data" />
        </div>
    </div>
</template>
