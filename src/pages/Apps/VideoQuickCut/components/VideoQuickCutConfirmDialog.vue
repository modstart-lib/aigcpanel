<script setup lang="ts">
import { nextTick, ref } from "vue";
import { t } from "../../../../lang";
import { Dialog } from "../../../../lib/dialog";
import { VideoQuickCutSegment } from "../type";
import { TimeUtil } from "../../../../lib/util";

type RecordSegment = VideoQuickCutSegment & {
    startSeconds?: number; // 开始时间，单位秒
    endSeconds?: number; // 结束时间，单位秒
    selected?: boolean; // 是否选中
};

const props = defineProps({
    saveTitle: {
        type: String,
        default: () => t("common.save"),
    },
});

const emit = defineEmits<{
    save: [taskId: number, records: VideoQuickCutSegment[]];
}>();

const visible = ref(false);
const currentTaskId = ref<number>(0);
const currentVideo = ref<string>("");
const currentDuration = ref<number>(0);
const currentRecords = ref<RecordSegment[]>([]);
const currentIndex = ref<number>(-1);
const playMode = ref<"all" | "selected">("all");
const videoRef = ref<HTMLVideoElement | null>(null);
const sliderMin = ref(0);
const sliderMax = ref(0);
const sliderValue = ref(0);
const selectedIndexes = ref<number[]>([]);
const lastSelectedIndex = ref<number>(-1);

const initEditingRecords = (initRecords: RecordSegment[]) => {
    const sortedRecords = [...initRecords].sort((a, b) => a.start - b.start);
    const filledRecords: RecordSegment[] = [];
    let currentTime = 0;
    sortedRecords.forEach((record) => {
        if (record.start > currentTime) {
            filledRecords.push({
                start: currentTime,
                end: record.start - 1,
                text: "",
                include: false,
                startSeconds: currentTime / 1000,
                endSeconds: record.start / 1000 - 0.001,
                selected: false,
            });
        }
        filledRecords.push({
            ...record,
            startSeconds: record.start / 1000,
            endSeconds: record.end / 1000,
            selected: false,
        });
        currentTime = record.end + 1;
    });
    if (currentTime < currentDuration.value) {
        filledRecords.push({
            start: currentTime,
            end: currentDuration.value,
            text: "",
            include: false,
            startSeconds: currentTime / 1000,
            endSeconds: currentDuration.value / 1000,
            selected: false,
        });
    }
    currentRecords.value = filledRecords;
};

const edit = (
    taskId: number,
    video: string,
    duration: number,
    records: RecordSegment[],
) => {
    currentTaskId.value = taskId || 0;
    currentVideo.value = `file://${video}`;
    currentDuration.value = duration || 0;
    currentIndex.value = -1;
    selectedIndexes.value = [];
    lastSelectedIndex.value = -1;
    initEditingRecords(records);
    visible.value = true;
};

defineExpose({
    edit,
});

const doSave = () => {
    const finalRecords = currentRecords.value.map((record) => ({
        start: record.start,
        end: record.end,
        text: record.text,
        include: record.include,
    }));
    emit("save", currentTaskId.value, finalRecords);
    visible.value = false;
};

const doCancel = () => {
    visible.value = false;
    currentRecords.value = [];
    currentIndex.value = -1;
    selectedIndexes.value = [];
    lastSelectedIndex.value = -1;
};

const onTimeUpdate = () => {
    const currentTime = videoRef.value?.currentTime || 0;
    const newIndex = currentRecords.value.findIndex(
        (record) =>
            (record.startSeconds || 0) <= currentTime &&
            currentTime < (record.endSeconds || 0),
    );
    sliderValue.value = currentTime;
    if (newIndex !== currentIndex.value) {
        currentIndex.value = newIndex;
        const currentRecord = currentRecords.value[newIndex];
        sliderMin.value = currentRecord.startSeconds || 0;
        sliderMax.value = currentRecord.endSeconds || 0;
        if (newIndex !== -1) {
            nextTick(() => {
                const el = document.querySelector(
                    `[data-segment-index='${newIndex}']`,
                ) as HTMLElement;
                if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                }
            });
        }
    }
    // 如果是只播放勾选部分模式，检查当前时间是否在勾选片段内
    if (playMode.value === "selected" && videoRef.value) {
        const currentRecord = currentRecords.value[newIndex];
        if (newIndex === -1 || !currentRecord?.include) {
            const nextSelectedIndex = currentRecords.value.findIndex(
                (record, index) => index > newIndex && record.include,
            );
            if (nextSelectedIndex !== -1) {
                const nextRecord = currentRecords.value[nextSelectedIndex];
                videoRef.value.currentTime = nextRecord.startSeconds || 0;
            } else {
                videoRef.value.pause();
                Dialog.tipSuccess(t("msg.playedLastSelected"));
            }
        }
    }
};
const onSegmentClick = (record: RecordSegment) => {
    if (videoRef.value) {
        videoRef.value.currentTime = record.startSeconds || 0;
        videoRef.value.play();
    }
};

const onSegmentSelect = (index: number, event: MouseEvent) => {
    const record = currentRecords.value[index];
    if (event.shiftKey && lastSelectedIndex.value !== -1) {
        const start = Math.min(lastSelectedIndex.value, index);
        const end = Math.max(lastSelectedIndex.value, index);
        selectedIndexes.value = [];
        for (let i = start; i <= end; i++) {
            selectedIndexes.value.push(i);
            currentRecords.value[i].selected = true;
        }
    } else {
        if (event.ctrlKey || event.metaKey) {
            if (record.selected) {
                selectedIndexes.value = selectedIndexes.value.filter(
                    (i) => i !== index,
                );
                record.selected = false;
            } else {
                selectedIndexes.value.push(index);
                record.selected = true;
            }
        } else {
            selectedIndexes.value.forEach((i) => {
                currentRecords.value[i].selected = false;
            });
            selectedIndexes.value = [index];
            record.selected = true;
        }
        lastSelectedIndex.value = index;
    }
};

const onPlayModeChange = (value: boolean) => {
    playMode.value = value ? "selected" : "all";
};

const onSliderChange = (value: number) => {
    if (videoRef.value) {
        videoRef.value.currentTime = value;
    }
};

const doMerge = () => {
    if (selectedIndexes.value.length < 2) {
        return;
    }
    // 检查必须是连续的片段才可以合并
    const sorted = selectedIndexes.value.sort((a, b) => a - b);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (last - first !== sorted.length - 1) {
        Dialog.tipError(t("error.onlyMergeConsecutive"));
        return;
    }
    const text = currentRecords.value
        .slice(first, last + 1)
        .map((r) => r.text)
        .join("");
    const textJoin = currentRecords.value
        .slice(first, last + 1)
        .map((r) => r.text)
        .join("；");
    const merged = {
        start: currentRecords.value[first].start,
        end: currentRecords.value[last].end,
        text: text ? textJoin : "",
        include: currentRecords.value
            .slice(first, last + 1)
            .some((r) => r.include),
        startSeconds: currentRecords.value[first].startSeconds,
        endSeconds: currentRecords.value[last].endSeconds,
        selected: false,
    };
    currentRecords.value.splice(first, last - first + 1, merged);
    selectedIndexes.value = [];
    nextTick(() => {
        onTimeUpdate();
    });
};

const doSplit = () => {
    if (currentIndex.value === -1) {
        return;
    }
    const record = currentRecords.value[currentIndex.value];
    if (!(
        sliderValue.value > record.startSeconds! &&
        sliderValue.value < record.endSeconds!
    )) {
        Dialog.tipError(t("error.timeRangeInvalid"));
        return;
    }
    const newRecord = {
        start: Math.floor(sliderValue.value * 1000),
        end: record.end,
        text: record.text,
        include: true,
        startSeconds: sliderValue.value,
        endSeconds: record.endSeconds,
        selected: false,
    };
    record.end = newRecord.start - 1;
    record.endSeconds = newRecord.startSeconds - 0.01;
    currentRecords.value.splice(currentIndex.value + 1, 0, newRecord);
    nextTick(() => {
        onTimeUpdate();
    });
};
</script>

<template>
    <a-modal v-model:visible="visible" width="95vw" title-align="start">
        <template #title> {{ $t("common.manualEditSegment") }} </template>
        <template #footer>
            <a-button @click="doCancel">{{ $t("common.cancel") }}</a-button>
            <a-button type="primary" @click="doSave">{{
                props.saveTitle
            }}</a-button>
        </template>
        <div
            v-if="visible"
            class="flex gap-2 h-full -mx-4 -my-5"
            style="height: calc(100vh - 15rem)"
        >
            <div class="w-1/2 flex flex-col">
                <div
                    class="bg-gray-100 p-2 border-b rounded-lg flex items-center"
                >
                    <div class="text-sm font-medium text-gray-700 flex-grow">
                        {{ $t("common.segment") }}
                    </div>
                    <div>
                        <a-button
                            size="mini"
                            type="primary"
                            class="ml-1"
                            @click="doSplit"
                            :disabled="currentIndex === -1"
                        >
                            {{ $t("common.split") }}
                        </a-button>
                        <a-button
                            size="mini"
                            type="primary"
                            class="ml-1"
                            @click="doMerge"
                            :disabled="selectedIndexes.length < 2"
                        >
                            {{ $t("common.merge") }}
                        </a-button>
                    </div>
                </div>
                <div
                    v-if="currentRecords.length === 0"
                    class="text-center text-gray-500 py-4"
                >
                    {{ $t("empty.noEditableData") }}
                </div>
                <div
                    v-else
                    class="flex-grow space-y-1 overflow-y-auto border p-1 rounded-lg"
                >
                    <div
                        v-for="(record, index) in currentRecords"
                        :key="index"
                        :data-segment-index="index + ''"
                        :class="[
                            'border rounded p-1 hover:shadow mb-1',
                            record.selected ? 'border-red-400' : '',
                            index === currentIndex ? 'bg-blue-50' : '',
                        ]"
                    >
                        <div class="">
                            <div class="flex items-start">
                                <div
                                    class="cursor-pointer w-8 flex-shrink-0 pt-2"
                                    @click="onSegmentClick(record)"
                                >
                                    <icon-right-circle class="text-xl" />
                                </div>
                                <div class="flex-grow">
                                    <div class="flex items-center">
                                        <div
                                            class="text-xs flex-grow text-gray-600 font-mono select-none"
                                            @click="
                                                onSegmentSelect(index, $event)
                                            "
                                        >
                                            {{
                                                TimeUtil.secondsToTime(
                                                    record.startSeconds!,
                                                    true,
                                                )
                                            }}
                                            -
                                            {{
                                                TimeUtil.secondsToTime(
                                                    record.endSeconds!,
                                                    true,
                                                )
                                            }}
                                        </div>
                                        <a-checkbox v-model="record.include" />
                                    </div>
                                    <div
                                        class="text-xs pt-1 select-none"
                                        @click="onSegmentSelect(index, $event)"
                                    >
                                        {{
                                            record.text ||
                                            $t("common.emptySegment")
                                        }}
                                    </div>
                                    <div
                                        v-if="index === currentIndex"
                                        class="pt-2"
                                    >
                                        <a-slider
                                            :min="sliderMin"
                                            :max="sliderMax"
                                            :step="0.001"
                                            :model-value="sliderValue"
                                            @change="onSliderChange"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="w-1/2 flex flex-col">
                <div
                    class="bg-gray-100 p-2 border-b rounded-lg flex items-center"
                >
                    <div class="text-sm font-medium text-gray-700 flex-grow">
                        {{ $t("common.preview") }}
                    </div>
                    <div>
                        <a-checkbox
                            :model-value="playMode === 'selected'"
                            class="text-xs"
                            @change="onPlayModeChange"
                        >
                            {{ $t("common.playOnlySelected") }}
                        </a-checkbox>
                    </div>
                </div>
                <div class="flex-grow rounded-lg border p-1">
                    <video
                        ref="videoRef"
                        :src="currentVideo"
                        controls
                        class="w-full h-full bg-black"
                        @timeupdate="onTimeUpdate"
                    ></video>
                </div>
            </div>
        </div>
    </a-modal>
</template>
