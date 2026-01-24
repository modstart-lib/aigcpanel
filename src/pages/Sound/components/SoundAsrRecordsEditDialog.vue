<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import DataConfigDialogButton from "../../../components/common/DataConfigDialogButton.vue";
import { t } from "../../../lang";
import { Dialog } from "../../../lib/dialog";
import { TimeUtil } from "../../../lib/util";
import ModelGenerateButton, { ModelGenerateButtonOptionType } from "../../../module/Model/ModelGenerateButton.vue";
import { SoundAsrResultOptimizedPrompt } from "../config/prompt";
import { SoundGenerateReplaceContent } from "../config/replaceContent";
import SoundAsrRecordsSubtitlePreviewDialog from "./SoundAsrRecordsSubtitlePreviewDialog.vue";
import SoundGeneratePreviewBox from "./SoundGeneratePreviewBox.vue";

interface AsrRecord {
    start: number;
    end: number;
    text: string;
}

interface EditingAsrRecord extends AsrRecord {
    startSeconds?: number;
    endSeconds?: number;
}

const props = defineProps({
    saveTitle: {
        type: String,
        default: t("common.save"),
    },
    soundGenerate: {
        type: Object,
        default: () => null,
    }
});

const emit = defineEmits<{
    save: [taskId: number, records: AsrRecord[]];
}>();

const visible = ref(false);
const editingRecords = ref<EditingAsrRecord[]>([]);
const currentRecords = ref<AsrRecord[]>([]);
const currentTaskId = ref<number>(0);
const currentMedia = ref<string>("");
const currentDuration = ref<number>(0);
const currentIndex = ref<number>(-1);
const mediaRef = ref<HTMLAudioElement | HTMLVideoElement | null>(null);
const sliderMin = ref(0);
const sliderMax = ref(0);
const sliderValue = ref(0);
const selectedIndexes = ref<number[]>([]);
const lastSelectedIndex = ref<number>(-1);

// 每分钟字数，用于计算maxLength
const wordsPerMinute = ref(250);

// 预览对话框引用
const previewDialog = ref<InstanceType<typeof SoundAsrRecordsSubtitlePreviewDialog> | null>(null);

// 计算属性：检查是否有连续的空白片段
const hasConsecutiveBlanks = computed(() => {
    for (let i = 0; i < editingRecords.value.length - 1; i++) {
        if (editingRecords.value[i].text.trim() === '' && editingRecords.value[i + 1].text.trim() === '') {
            return true;
        }
    }
    return false;
});

// 计算属性：总字数统计
const totalWords = computed(() => {
    return editingRecords.value.reduce((sum, record) => sum + calculateCustomLength(record.text), 0);
});

// 计算自定义长度：英文单词算两个长度，汉字算1个，字符不算
const calculateCustomLength = (text: string): number => {
    let length = 0;
    // 汉字算1个
    const chineseChars = text.match(/[\u4e00-\u9fa5]/g);
    if (chineseChars) length += chineseChars.length;
    // 英文单词算2个
    const englishWords = text.match(/\b[a-zA-Z]+\b/g);
    if (englishWords) length += englishWords.length * 2;
    // 其他字符不算
    return length;
};

// 计算maxLength，根据记录时长和每分钟字数
const getMaxLength = (record: EditingAsrRecord) => {
    const durationSeconds = (record.endSeconds || 0) - (record.startSeconds || 0);
    return Math.floor(durationSeconds * wordsPerMinute.value / 60);
};

const edit = (
    taskId: number,
    records: AsrRecord[],
    audioOrVideo: string,
    duration: number
) => {
    currentRecords.value = records;
    currentTaskId.value = taskId || 0;
    currentMedia.value = `file://${audioOrVideo}`;
    currentDuration.value = duration || 0;
    currentIndex.value = -1;
    selectedIndexes.value = [];
    lastSelectedIndex.value = -1;
    initEditingRecords();
    visible.value = true;
};

// 初始化编辑记录，补全空白时间
const initEditingRecords = () => {
    if (!currentRecords.value || currentRecords.value.length === 0) {
        editingRecords.value = [];
        return;
    }

    const sortedRecords = [...currentRecords.value].sort((a, b) => a.start - b.start);
    const filledRecords: EditingAsrRecord[] = [];
    let currentTime = 0;
    sortedRecords.forEach(record => {
        if (record.start > currentTime) {
            filledRecords.push({
                start: currentTime,
                end: record.start - 1,
                text: "",
                startSeconds: currentTime / 1000,
                endSeconds: record.start / 1000 - 0.001,
            });
        }
        filledRecords.push({
            ...record,
            startSeconds: record.start / 1000,
            endSeconds: record.end / 1000,
        });
        currentTime = record.end + 1;
    });
    if (currentTime < currentDuration.value) {
        filledRecords.push({
            start: currentTime,
            end: currentDuration.value,
            text: "",
            startSeconds: currentTime / 1000,
            endSeconds: currentDuration.value / 1000,
        });
    }
    editingRecords.value = filledRecords;
};

// 从秒转换为毫秒
const secondsToMs = (seconds: number) => {
    return Math.round(seconds * 1000);
};

// 保存编辑，过滤空白条目
const doSave = () => {
    if (!editingRecords.value || editingRecords.value.length === 0) {
        Dialog.tipError(t("soundAsrEdit.noEditRecord"));
        return;
    }
    // 过滤空白条目
    const finalRecords = editingRecords.value
        .filter(record => record.text.trim() !== "")
        .map(record => ({
            start: secondsToMs(record.startSeconds || 0),
            end: secondsToMs(record.endSeconds || 0),
            text: record.text,
        }));
    emit("save", currentTaskId.value, finalRecords);
    visible.value = false;
};

// 取消编辑
const doCancel = () => {
    visible.value = false;
    editingRecords.value = [];
    currentIndex.value = -1;
    selectedIndexes.value = [];
    lastSelectedIndex.value = -1;
};

// 查找替换功能
const findText = ref("");
const replaceText = ref("");

const onFindReplace = () => {
    if (!findText.value.trim()) {
        Dialog.tipError(t("soundAsrEdit.inputSearchContent"));
        return;
    }

    let replaceCount = 0;
    editingRecords.value.forEach(record => {
        if (record.text.includes(findText.value)) {
            record.text = record.text.replace(new RegExp(findText.value, "g"), replaceText.value);
            replaceCount++;
        }
    });

    if (replaceCount > 0) {
        Dialog.tipSuccess(t("soundAsrEdit.replacedRecords", {count: replaceCount}));
    } else {
        Dialog.tipError(t("soundAsrEdit.noMatchFound"));
    }
};

// 点击记录跳转到音频时间
const onRecordClick = (record: EditingAsrRecord) => {
    if (mediaRef.value) {
        mediaRef.value.currentTime = record.startSeconds || 0;
        mediaRef.value.play();
    }
};

// 音频时间更新，高亮当前记录
const onTimeUpdate = () => {
    const currentTime = mediaRef.value?.currentTime || 0;
    const newIndex = editingRecords.value.findIndex((record) =>
        (record.startSeconds || 0) <= currentTime && currentTime < (record.endSeconds || 0)
    );
    sliderValue.value = currentTime;
    if (newIndex !== currentIndex.value) {
        currentIndex.value = newIndex;
        const currentRecord = editingRecords.value[newIndex];
        sliderMin.value = currentRecord.startSeconds || 0;
        sliderMax.value = currentRecord.endSeconds || 0;
        if (newIndex !== -1) {
            nextTick(() => {
                const el = document.querySelector(`[data-record-index='${newIndex}']`) as HTMLElement;
                if (el) {
                    el.scrollIntoView({behavior: "smooth", block: "center"});
                }
            });
        }
    }
};

// 滑动条变化
const onSliderChange = (value: number) => {
    if (mediaRef.value) {
        mediaRef.value.currentTime = value;
    }
};

// 合并选中记录
const doMerge = () => {
    if (selectedIndexes.value.length < 2) {
        return;
    }
    // 检查必须是连续的片段才可以合并
    const sorted = selectedIndexes.value.sort((a, b) => a - b);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (last - first !== sorted.length - 1) {
        Dialog.tipError(t("soundAsrEdit.mergeOnlyContinuous"));
        return;
    }
    const text = editingRecords.value.slice(first, last + 1).map(r => r.text).filter(t => t).join('；');
    const merged = {
        start: editingRecords.value[first].start,
        end: editingRecords.value[last].end,
        text: text,
        startSeconds: editingRecords.value[first].startSeconds,
        endSeconds: editingRecords.value[last].endSeconds,
    };
    editingRecords.value.splice(first, last - first + 1, merged);
    selectedIndexes.value = [];
    nextTick(() => {
        onTimeUpdate();
    });
};

// 一键合并空白
const doMergeBlanks = () => {
    const newRecords: EditingAsrRecord[] = [];
    let currentBlank: EditingAsrRecord | null = null;

    for (const record of editingRecords.value) {
        if (record.text.trim() === '') {
            if (currentBlank) {
                currentBlank.end = record.end;
                currentBlank.endSeconds = record.endSeconds;
            } else {
                currentBlank = {...record};
            }
        } else {
            if (currentBlank) {
                newRecords.push(currentBlank);
                currentBlank = null;
            }
            newRecords.push(record);
        }
    }

    if (currentBlank) {
        newRecords.push(currentBlank);
    }

    editingRecords.value = newRecords;
    Dialog.tipSuccess(t("soundAsrEdit.mergedBlankSegments"));
};

// 一键优化时间线
const doOptimizeTimeline = () => {
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < editingRecords.value.length; i++) {
        const record = editingRecords.value[i];
        const maxLength = getMaxLength(record);
        if (calculateCustomLength(record.text) > maxLength) {
            if (i + 1 < editingRecords.value.length && editingRecords.value[i + 1].text.trim() === '') {
                // 计算需要额外时间
                const extraWords = calculateCustomLength(record.text) - maxLength;
                const extraTime = extraWords * 60 / wordsPerMinute.value; // 秒

                // 下一句的时长
                const nextDuration = (editingRecords.value[i + 1].endSeconds || 0) - (editingRecords.value[i + 1].startSeconds || 0);

                // 实际挪的时间
                const moveTime = Math.min(extraTime, nextDuration);

                if (moveTime > 0) {
                    if (moveTime >= nextDuration) {
                        // 下一句时间会被完全占用，删除下一句
                        record.endSeconds = editingRecords.value[i + 1].endSeconds;
                        record.end = secondsToMs(record.endSeconds || 0);
                        editingRecords.value.splice(i + 1, 1);
                        i--; // 调整索引，因为删除了一个元素
                    } else {
                        // 延长本句
                        record.endSeconds = (record.endSeconds || 0) + moveTime;
                        record.end = secondsToMs(record.endSeconds);

                        // 缩短下一句
                        editingRecords.value[i + 1].startSeconds = (editingRecords.value[i + 1].startSeconds || 0) + moveTime;
                        editingRecords.value[i + 1].start = secondsToMs(editingRecords.value[i + 1].startSeconds || 0);
                    }
                    successCount++;
                } else {
                    failCount++;
                }
            } else {
                failCount++;
            }
        }
    }

    Dialog.tipSuccess(t("soundAsrEdit.optimizeComplete", {successCount, failCount}));
};

// 合并到前一条
const doMergeToPrevious = (index: number) => {
    if (index <= 0) return;
    const current = editingRecords.value[index];
    const previous = editingRecords.value[index - 1];
    // 合并文本，如果当前有文本，用分号连接
    if (current.text.trim()) {
        previous.text += (previous.text.trim() ? '；' : '') + current.text.trim();
    }
    // 更新结束时间
    previous.end = current.end;
    previous.endSeconds = current.endSeconds;
    // 删除当前记录
    editingRecords.value.splice(index, 1);
    // 更新选择状态
    selectedIndexes.value = selectedIndexes.value.filter(i => i !== index).map(i => i > index ? i - 1 : i);
    if (currentIndex.value === index) {
        currentIndex.value = index - 1;
    } else if (currentIndex.value > index) {
        currentIndex.value--;
    }
    lastSelectedIndex.value = lastSelectedIndex.value > index ? lastSelectedIndex.value - 1 : lastSelectedIndex.value;
};

// 分割当前记录
const doSplit = () => {
    if (currentIndex.value === -1) {
        return;
    }
    const record = editingRecords.value[currentIndex.value];
    if (!(sliderValue.value > record.startSeconds! && sliderValue.value < record.endSeconds!)) {
        Dialog.tipError(t("soundAsrEdit.invalidTimeRange"));
        return;
    }
    const newRecord = {
        start: Math.floor(sliderValue.value * 1000),
        end: record.end,
        text: record.text,
        startSeconds: sliderValue.value,
        endSeconds: record.endSeconds,
    };
    record.end = newRecord.start - 1;
    record.endSeconds = newRecord.startSeconds - 0.001;
    editingRecords.value.splice(currentIndex.value + 1, 0, newRecord);
    nextTick(() => {
        onTimeUpdate();
    });
};

// 记录选择
const onRecordSelect = (index: number, event: MouseEvent) => {
    const record = editingRecords.value[index];
    if (event.shiftKey && lastSelectedIndex.value !== -1) {
        const start = Math.min(lastSelectedIndex.value, index);
        const end = Math.max(lastSelectedIndex.value, index);
        selectedIndexes.value = [];
        for (let i = start; i <= end; i++) {
            selectedIndexes.value.push(i);
        }
    } else {
        if (event.ctrlKey || event.metaKey) {
            if (selectedIndexes.value.includes(index)) {
                selectedIndexes.value = selectedIndexes.value.filter(i => i !== index);
            } else {
                selectedIndexes.value.push(index);
            }
        } else {
            selectedIndexes.value = [index];
        }
        lastSelectedIndex.value = index;
    }
};

// 复选框变化
const onCheckboxChange = (index: number, checked: boolean) => {
    if (checked) {
        if (!selectedIndexes.value.includes(index)) {
            selectedIndexes.value.push(index);
        }
    } else {
        selectedIndexes.value = selectedIndexes.value.filter(i => i !== index);
    }
    lastSelectedIndex.value = index;
};

const aiIndex = ref(0);

const aiOption: ModelGenerateButtonOptionType = {
    mode: 'repeat',
    promptDefault: SoundAsrResultOptimizedPrompt,
    onStart: async () => {
        console.log('AI优化开始');
        aiIndex.value = 0;
    },
    onEnd: async () => {
        console.log('AI优化结束');
    },
    onGetParam: async () => {
        console.log('AI优化获取参数, index=', aiIndex.value);
        // get next none empty record
        while (aiIndex.value < editingRecords.value.length) {
            const record = editingRecords.value[aiIndex.value];
            aiIndex.value++;
            if (record.text.trim()) {
                return {
                    content: record.text.trim(),
                };
            }
        }
        return null;
    },
    onResult: async (result: string, param: Record<string, any>) => {
        const index = aiIndex.value - 1;
        console.log('AI优化结果:', {index, result, param});
        onRecordClick(editingRecords.value[index]);
        setTimeout(() => {
            editingRecords.value[index].text = result.trim();
        }, 1000);
    },
}

defineExpose({
    edit,
});
</script>

<template>
    <a-modal v-model:visible="visible" width="95vw" title-align="start">
        <template #title>
            <div class="flex items-center gap-4">
                <div class="font-bold mr-2">
                    {{ $t("task.editResult") }}
                </div>
                <div class="flex items-center">
                    <span class="text-sm mr-2">{{ $t("setting.wpm") }}:</span>
                    <a-input-number
                        v-model="wordsPerMinute"
                        :min="1"
                        :max="1000"
                        size="small"
                        style="width:80px"
                    />
                </div>
                <DataConfigDialogButton
                    size="small"
                    title="声音合成优化"
                    name="SoundGenerateReplaceContent"
                    help="声音合成时会自动把文本中的“键”替换为“值”，可用于修正发音"
                    :default-value="SoundGenerateReplaceContent">
                    <div class="mb-2">
                        <SoundGeneratePreviewBox :sound-generate="soundGenerate as any"/>
                    </div>
                </DataConfigDialogButton>
                <div class="text-sm text-gray-500">{{ $t("common.totalWords", {count: totalWords}) }}</div>
            </div>
        </template>
        <template #footer>
            <a-button @click="doCancel">{{ $t("common.cancel") }}</a-button>
            <a-button type="primary" @click="doSave">{{ props.saveTitle }}</a-button>
        </template>
        <div v-if="visible" class="flex flex-col gap-1 h-full -mx-4 -my-5" style="height:calc(100vh - 12rem);">

            <div class="bg-gray-100 p-2 border-b rounded-lg" v-if="currentMedia">
                <video
                    ref="mediaRef"
                    v-if="currentMedia.endsWith('mp4')"
                    :src="currentMedia"
                    controls
                    class="w-full h-32"
                    @timeupdate="onTimeUpdate"
                ></video>
                <audio
                    ref="mediaRef"
                    v-else
                    :src="currentMedia"
                    controls
                    class="w-full"
                    @timeupdate="onTimeUpdate"
                ></audio>
            </div>

            <div class="bg-white rounded-lg p-2 flex items-center justify-between gap-2">
                <div class="flex items-center gap-1">
                    <a-input
                        v-model="findText"
                        :placeholder="$t('common.find')"
                        size="small"
                        style="width:100px"
                        allow-clear
                    />
                    <a-input
                        v-model="replaceText"
                        :placeholder="$t('common.replace')"
                        size="small"
                        style="width:100px"
                        allow-clear
                    />
                    <a-button size="small" class="px-2" @click="onFindReplace" :disabled="!findText.trim()">
                        <template #icon>
                            <icon-check/>
                        </template>
                    </a-button>
                    <a-button size="small" class="px-2" type="primary" @click="doMergeBlanks"
                              :disabled="!hasConsecutiveBlanks">
                        {{ $t("common.mergeWhitespace") }}
                    </a-button>
                    <a-button size="small" class="px-2" type="primary" @click="doSplit" :disabled="currentIndex === -1">
                        {{ $t("common.split") }}
                    </a-button>
                    <a-button size="small" class="px-2" type="primary" @click="doMerge"
                              :disabled="selectedIndexes.length < 2">
                        {{ $t("common.merge") }}
                        <span v-if="selectedIndexes.length">
                            ({{ selectedIndexes.length }})
                        </span>
                    </a-button>
                    <a-button size="small" class="px-2" type="primary"
                              @click="previewDialog?.show(editingRecords);">
                        {{ $t("media.subtitle") }}
                    </a-button>
                    <a-button size="small" class="px-2" type="primary"
                              @click="doOptimizeTimeline">
                        {{ $t("task.optimizeTimeline") }}
                    </a-button>
                    <ModelGenerateButton
                        biz="SoundReplaceAsrResultOptimizedPrompt"
                        title="AI一键优化"
                        :option="aiOption"
                    />
                </div>
            </div>

            <div class="flex-grow overflow-y-auto border rounded-lg p-2">
                <!-- 没有数据提示 -->
                <div v-if="editingRecords.length === 0" class="text-center text-gray-500 py-4">
                    {{ $t("empty.noEditableData") }}
                </div>
                <!-- 表格编辑 -->
                <div v-else class="space-y-1">
                    <div
                        v-for="(record, index) in editingRecords"
                        :key="index"
                        :data-record-index="index + ''"
                        :class="[
                            'border rounded p-2 hover:shadow cursor-pointer',
                            selectedIndexes.includes(index) ? 'border-red-400 bg-red-50' : '',
                            index === currentIndex ? 'bg-blue-50 border-blue-400' : ''
                        ]"
                        @click="onRecordClick(record)"
                    >
                        <div class="flex items-start">
                            <div class="flex-grow">
                                <div class="flex items-center mb-1">
                                    <a-tag class="rounded-lg mr-3"
                                           :color="calculateCustomLength(record.text) > getMaxLength(record)?'red':undefined">
                                        {{ index + 1 }}
                                    </a-tag>
                                    <div class="flex-grow text-xs text-gray-600 font-mono select-none">
                                        {{ TimeUtil.msToTime(record.start) }} - {{ TimeUtil.msToTime(record.end) }}
                                    </div>
                                    <div class="flex items-center gap-3" @click.stop>
                                        <div class="text-xs font-mono bg-gray-100 rounded-lg px-2 leading-6"
                                             :class="{'bg-red-100 text-red-600': calculateCustomLength(record.text) > getMaxLength(record)}">
                                            {{ calculateCustomLength(record.text) }}
                                            /
                                            {{ getMaxLength(record) }}
                                        </div>
                                        <a-button v-if="index>0" size="mini" @click="doMergeToPrevious(index)">
                                            <template #icon>
                                                <icon-arrow-up/>
                                            </template>
                                            合并到前一条
                                        </a-button>
                                        <a-checkbox
                                            :model-value="selectedIndexes.includes(index)"
                                            @change="(checked) => onCheckboxChange(index, checked)"
                                            class="ml-2 self-start"
                                        />
                                    </div>
                                </div>
                                <div class="text-sm" @click.stop>
                                    <a-textarea
                                        v-model="record.text"
                                        :auto-size="{minRows: 1, maxRows: 3}"
                                        size="mini"
                                        :textarea-attrs="{tabindex:index}"
                                        show-word-limit
                                        placeholder="输入文本"
                                    />
                                </div>
                                <div v-if="index === currentIndex" class="px-2">
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
    </a-modal>
    <SoundAsrRecordsSubtitlePreviewDialog ref="previewDialog"/>
</template>
