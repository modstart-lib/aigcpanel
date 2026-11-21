<script setup lang="ts">
import ImageToImageFormViewBody from "./ImageToImageFormViewBody.vue";

const props = defineProps<{
    data: any;
}>();
</script>

<template>
    <div class="mb-4">
        <div class="font-bold mb-2">{{ $t("app.imageToImageConfig") }}</div>
        <div class="flex flex-wrap gap-1">
            <ImageToImageFormViewBody :data="data" />
        </div>
    </div>
</template>
