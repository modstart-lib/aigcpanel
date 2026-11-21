<script setup lang="ts">
import ImageToVideoFormViewBody from "./ImageToVideoFormViewBody.vue";

const props = defineProps<{
    data: any;
}>();
</script>

<template>
    <div class="mb-4">
        <div class="font-bold mb-2">{{ $t("app.imageToVideoConfig") }}</div>
        <div class="flex flex-wrap gap-1">
            <ImageToVideoFormViewBody :data="data" />
        </div>
    </div>
</template>
