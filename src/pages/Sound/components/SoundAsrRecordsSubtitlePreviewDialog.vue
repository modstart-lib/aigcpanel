<script setup lang="ts">
import { computed, ref } from "vue";
import { TimeUtil } from "../../../lib/util";
import { subtitleGenerateSrtContent, subtitleGenerateRecords } from "../../../lib/subtitle";

interface EditingAsrRecord {
    start: number;
    end: number;
    text: string;
    startSeconds?: number;
    endSeconds?: number;
}

const props = defineProps<{
    records?: EditingAsrRecord[];
}>();

const visible = ref(false);
const currentRecords = ref<EditingAsrRecord[]>([]);

const subtitleContent = computed(() => {
    if (!currentRecords.value || currentRecords.value.length === 0) {
        return "";
    }
    const records = subtitleGenerateRecords(currentRecords.value as any);
    return subtitleGenerateSrtContent(records.map(r => ({
        start: r.start,
        end: r.end,
        text: r.text,
    })));
});

const dataSource = computed(() => {
    return currentRecords.value.map(record => ({
        time: `${TimeUtil.msToTime(record.start)} - ${TimeUtil.msToTime(record.end)}`,
        text: record.text
    }));
});

const show = (records: EditingAsrRecord[]) => {
    currentRecords.value = records.filter(r => r.text && r.text.trim() !== "");
    visible.value = true;
};

defineExpose({
    show,
});
</script>

<template>
    <a-modal v-model:visible="visible" width="800px" title-align="start">
        <template #title>
            {{ $t("media.subtitlePreview") }}
        </template>
        <template #footer>
            <a-button @click="visible = false">{{ $t("common.close") }}</a-button>
        </template>
        <div class="-mx-4 -my-5 overflow-y-auto" style="max-height:calc( 100vh - 20rem);">
            <div class="border border-gray-200 rounded-lg shadow-md bg-white text-xs">
                <div class="flex items-center border-b border-gray-200 py-3 font-semibold bg-blue-50 text-blue-800 rounded-t-lg">
                    <div class="w-48 flex-shrink-0 px-4 text-center">时间</div>
                    <div class="flex-1 px-4 text-center">字幕</div>
                </div>
                <div v-for="(item, index) in dataSource" :key="item.time" :class="['flex items-center border-b border-gray-100 py-3 hover:bg-gray-50', index % 2 === 0 ? 'bg-white' : 'bg-gray-50']">
                    <div class="w-48 flex-shrink-0 px-4 text-right text-gray-600 font-mono">{{ item.time }}</div>
                    <div class="flex-1 px-4 text-left text-gray-800">{{ item.text }}</div>
                </div>
            </div>
        </div>
    </a-modal>
</template>
