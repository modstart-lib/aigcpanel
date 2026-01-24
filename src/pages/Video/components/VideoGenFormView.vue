<script setup lang="ts">
import VideoGenFormViewBody from "./VideoGenFormViewBody.vue";

const props = defineProps<{
    data: any;
}>();
</script>

<template>
    <div class="mb-2">
        <div class="font-bold mb-2">
            {{ $t("voice.recognitionConfig") }}
        </div>
        <div>
            <VideoGenFormViewBody :data="data" />
        </div>
    </div>
</template>
