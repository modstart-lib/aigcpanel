<script setup lang="ts">
import {defineProps} from "vue";

const props = defineProps({
    page: {
        type: Boolean,
        default: false,
    },
    blocks: {
        type: Number,
        default: 8,
    },
});
</script>
<template>
    <div class="py-10 text-center text-gray-400">
        <div v-if="props.page">
            <div v-for="i in props.blocks" class="bg-gray-100 h-10 rounded-lg mb-5"></div>
        </div>
        <div v-else>
            <a-spin style="--primary-6: #999" />
            <div class="text-sm">
                {{ $t("status.loading") }}
            </div>
        </div>
    </div>
</template>
