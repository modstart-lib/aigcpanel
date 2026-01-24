<script setup lang="ts">
import { t } from "../../../../lang";
const stepDescriptions = [
    { key: 1, label: t('soundReplace.extractAndRecognize'), description: t('soundReplace.extractAndRecognizeDesc') },
    { key: 2, label: t('soundReplace.confirmText'), description: t('soundReplace.confirmTextDesc') },
    { key: 3, label: t('soundReplace.synthesizeReplace'), description: t('soundReplace.synthesizeReplaceDesc') },
];
</script>

<template>
    <div class="rounded-xl shadow border p-4 mb-3">
        <div class="w-full flex flex-col items-center">
            <div class="flex items-center overflow-x-auto">
                <template v-for="(step, idx) in stepDescriptions" :key="step.key">
                    <div class="flex items-center" :class="idx > 0 ? 'ml-6' : ''">
                        <div class="rounded-full w-9 h-9 flex items-center justify-center text-base font-bold transition-all duration-200 shadow"
                            :class="'bg-white border-2 ' + (idx === 0 ? 'border-blue-400' : 'border-gray-300')"
                            style="box-shadow: 0 2px 8px 0 rgba(0,0,0,0.04);">
                            <span class="text-blue-500">{{ idx + 1 }}</span>
                        </div>
                        <div class="ml-2 text-base font-medium whitespace-nowrap">{{ step.label }}</div>
                        <div v-if="idx < stepDescriptions.length - 1" class="w-8 h-1 mx-2 rounded bg-gray-200"></div>
                    </div>
                </template>
            </div>
        </div>
    </div>
</template>

<style scoped>
@media (max-width: 600px) {
    .flex.items-center.mb-6.overflow-x-auto {
        flex-wrap: wrap;
        gap: 8px;
    }
}
</style>
