<script setup lang="ts">
import { computed, ref, useSlots } from "vue";

defineProps<{
    loading?: boolean;
    total?: number;
    hint?: string;
}>();

const emit = defineEmits<{ refresh: [] }>();

const filterExpanded = ref(false);
const slots = useSlots();
const hasFilters = computed(() => !!slots.default);
</script>

<template>
    <div class="mb-4">
        <div class="flex flex-wrap items-center gap-2">
            <div class="flex-1 flex flex-wrap items-center gap-2 min-w-0">
                <div
                    v-if="!hasFilters && total !== undefined"
                    class="flex items-center gap-1.5 text-gray-500 text-sm"
                >
                    <span
                        class="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"
                    />
                    共 {{ total }} 条
                    <span v-if="hint" class="text-gray-400">· {{ hint }}</span>
                </div>
                <slot />
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
                <a-button :loading="loading" @click="emit('refresh')">
                    <template #icon>
                        <icon-refresh />
                    </template>
                    {{ $t("monitor.refresh") }}
                </a-button>
                <slot name="actions" />
            </div>
        </div>
    </div>
</template>
