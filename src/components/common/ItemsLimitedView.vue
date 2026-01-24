<script setup lang="ts" generic="T">
import {ToggleUtil} from "../../lib/toggle";
import {computed} from "vue";

const props = withDefaults(defineProps<{
    records: T[];
    limit?: number;
    toggleBiz: string;
    toggleId: string | number;
}>(), {
    limit: 5,
});

defineSlots<{
    default(props: { item: T; index: number }): any;
}>();

const visibleRecords = computed(() => {
    return props.records.filter((o, i) => {
        return i < props.limit! || ToggleUtil.get(props.toggleBiz, props.toggleId, false).value;
    });
});

</script>

<template>
    <div class="max-h-96 overflow-y-auto">
        <div v-for="(record, index) in visibleRecords" :key="index">
            <slot :item="record" :index="index"></slot>
        </div>
    </div>
    <div v-if="props.records.length > props.limit!">
        <a-button
            v-if="!ToggleUtil.get(toggleBiz, toggleId, false).value"
            size="mini"
            class="px-1"
            @click="ToggleUtil.toggle(toggleBiz, toggleId)"
        >
            <template #icon>
                <icon-down/>
            </template>
            {{ $t("common.expand") }}
        </a-button>
        <a-button
            v-else
            size="mini"
            class="px-1"
            @click="ToggleUtil.toggle(toggleBiz, toggleId)">
            <template #icon>
                <icon-up/>
            </template>
            {{ $t("common.collapse") }}
        </a-button>
    </div>
</template>
