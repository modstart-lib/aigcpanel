<script setup lang="ts">
import SoundGenerateFormViewBody from "./SoundGenerateFormViewBody.vue";

const props = defineProps<{
    data: SoundGenerateParamType;
}>();
</script>

<template>
    <div class="mb-2">
        <div class="font-bold mb-2">
            {{ $t("voice.synthesisConfig") }}
        </div>
        <div class="flex flex-wrap gap-1 min-h-8">
            <SoundGenerateFormViewBody :data="data" />
        </div>
    </div>
</template>
