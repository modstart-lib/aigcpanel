<script setup lang="ts">
import SoundAsrFormViewBody from "./SoundAsrFormViewBody.vue";

const props = defineProps<{
    data: any;
}>();
</script>

<template>
    <div class="mb-1">
        <div class="font-bold mb-2">
            {{ $t("voice.recognitionConfig") }}
        </div>
        <div>
            <SoundAsrFormViewBody :data="data" />
        </div>
    </div>
</template>
