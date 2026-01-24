<template>
    <div>
        <div
            @click="doShow"
            class="leading-8 h-8 px-3 rounded-lg text-left cursor-pointer bg-gray-100 min-w-64 hover:bg-gray-200"
        >
            {{ speakerTitle || $t("voice.selectTimbre") }}
        </div>
        <a-modal
            v-model:visible="visible"
            :title="$t('voice.selectTimbre')"
            width="50rem"
            :footer="false"
            body-class="pb-speaker-selector-dialog-body"
            @before-close="onModalBeforeClose"
            append-to-body
        >
            <div>
                <div class="px-3 pt-3 mb-2">
                    <a-input
                        v-model="filterKeywords"
                        placeholder="请输入音色名称"
                        allow-clear
                        class="w-full"
                        size="small"
                    >
                        <template #append>
                            <icon-search/>
                        </template>
                    </a-input>
                </div>
                <div class="px-3 pb-2">
                    <div class="inline-block bg-gray-100 rounded-lg px-1 pt-1">
                        <a-button
                            class="mb-1 mr-1"
                            :type="!filterLang ? 'primary' : undefined"
                            @click="filterLang = ''"
                        >
                            所有语言
                        </a-button>
                        <a-button
                            v-for="l in langs"
                            :key="l.name"
                            class="mb-1 mr-1"
                            :type="filterLang === l.name ? 'primary' : undefined"
                            @click="filterLang = l.name"
                        >{{ l.name }}({{ l.count }})
                        </a-button>
                    </div>
                </div>
                <div class="overflow-auto ub-scroll-bar-mini px-3" style="height: 60vh">
                    <div v-if="filterRecords.length === 0 && speakers.length > 0">
                        <div class="text-center text-gray-400 py-20">
                            <div>
                                <icon-info-circle class="text-5xl"/>
                            </div>
                            <div class="mt-2">没有找到相关音色</div>
                        </div>
                    </div>
                    <div v-for="s in filterRecords" :key="s.name">
                        <div class="border mb-3 p-3 flex items-start rounded-lg shadow margin-top">
                            <div class="flex-grow">
                                <div class="mb-2 flex items-center">
                                    <img :src="s.cover" class="h-4 rounded-full shadow w-4 mr-1"/>
                                    <div class="font-bold">{{ s.title }}</div>
                                </div>
                                <div>
                                    <a-tag class="mr-1 mb-1" v-for="t in s.tags">{{ t }}</a-tag>
                                </div>
                            </div>
                            <div class="flex-shrink-0 w-26 flex items-start">
                                <div v-if="s.preview" class="pb-btn-preview">
                                    <AudioPlayerButton ref="audioPlayerButtons" :source="s.preview"/>
                                </div>
                                <a-button type="primary" @click="doSelect(s)" round> 选择</a-button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </a-modal>
    </div>
</template>

<script setup lang="ts">
import {computed, ref} from "vue";
import AudioPlayerButton from "./AudioPlayerButton.vue";

const audioPlayerButtons = ref<InstanceType<typeof AudioPlayerButton>[]>([]);

const props = defineProps({
    modelValue: {
        type: String,
        default: "",
    },
    speakers: {
        type: Array<{
            name: string;
            title: string;
            tags: string[];
            langs: string[];
            cover: string;
            preview: string;
            param: any[];
        }>,
        default: () => [],
    },
    disabled: {
        type: Boolean,
        default: false,
    },
});

const modelValue = defineModel();

const visible = ref(false);
const filterKeywords = ref("");
const filterTag = ref("");
const filterLang = ref("");

const speakerTitle = computed(() => {
    const speaker = props.speakers.find(s => s.name === modelValue.value);
    return speaker ? speaker.title : "";
});

const tags = computed(() => {
    return [...new Set(props.speakers.flatMap(s => s.tags))];
});

const langs = computed(() => {
    const langMap: Record<string, number> = {};
    props.speakers.forEach(s => {
        s.langs.forEach(l => {
            langMap[l] = (langMap[l] || 0) + 1;
        });
    });
    const result = Object.entries(langMap).map(([name, count]) => ({name, count}));
    const sortOrder = {中文: 1, 英文: 2, 中文方言: 3, 其他: 4};
    result.sort((a, b) => (sortOrder[a.name] || 999) - (sortOrder[b.name] || 999));
    return result;
});

const filterRecords = computed(() => {
    return props.speakers.filter(s => {
        if (filterTag.value && !s.tags.includes(filterTag.value)) return false;
        if (filterLang.value && !s.langs.includes(filterLang.value)) return false;
        if (filterKeywords.value) {
            const kw = filterKeywords.value.toLowerCase();
            if (!s.title.toLowerCase().includes(kw)) return false;
        }
        return true;
    });
});

const doStopAllAudios = () => {
    audioPlayerButtons.value.forEach(button => {
        button.stop();
    });
};

const onModalBeforeClose = () => {
    doStopAllAudios();
};

function doShow() {
    if (props.disabled) return;
    visible.value = true;
}

function doSelect(speaker) {
    doStopAllAudios();
    modelValue.value = speaker.name;
    emit("on-data-update", {
        param: speaker.param || [],
        speaker,
    });
    visible.value = false;
}

const emit = defineEmits(["on-data-update"]);
</script>

<style lang="less">
.pb-speaker-selector-dialog-body {
    padding: 0 !important;
}

.pb-btn-preview {
    display: inline-block;
    margin-right: 0.5rem;

    a {
        color: var(--color-primary);
        height: 32px;
        display: inline-block;
        padding: 0;
        width: 32px;
        line-height: 32px;

        svg {
            width: 32px;
            height: 32px;
        }
    }
}
</style>
