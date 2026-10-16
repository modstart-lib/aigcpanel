<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import AudioPlayer from "../common/AudioPlayer.vue";
import InputInlineEditor from "../common/InputInlineEditor.vue";
import ListerTop from "../common/ListerTop.vue";
import MEmpty from "../common/MEmpty.vue";
import MLoading from "../common/MLoading.vue";
import PageHeader from "../PageHeader.vue";
import { Dialog } from "../../lib/dialog";
import { t } from "../../lang";
import { VoiceRecord, VoiceServiceType } from "../../service/VoiceService";
import { testActionSet, testActionUnset } from "../../utils/test";
import VoiceEditDialog from "./VoiceEditDialog.vue";

const props = defineProps<{
    service: VoiceServiceType;
    /** 标题文案 key */
    titleKey: string;
    /** 描述文案 key */
    descKey?: string;
    /** 测试动作前缀，如 LiveVoice / SoundVoice */
    testPrefix: string;
}>();

const editDialog = ref<InstanceType<typeof VoiceEditDialog>>();
const records = ref<VoiceRecord[]>([]);
const loading = ref(true);

const loadRecords = async () => {
    records.value = await props.service.list();
};

/** 试听文本：优先使用保存时记录的文本，否则回退默认文本 */
const previewTextOf = (record: VoiceRecord) => {
    return record.content?.previewText || t("voice.previewDefault");
};

/**
 * 为缺少试听音频的音色在后台补齐试听（如保存时未点击试听）。
 * 立即标记 generating，卡片展示「试听语音生成中」，完成后刷新列表展示音频。
 */
const ensurePreviews = () => {
    for (const record of records.value) {
        const id = record.id as number;
        if (!id || record.content?.previewUrl) {
            continue;
        }
        // Voices without a model cannot synthesize yet (e.g. migrated legacy
        // voices), skip the auto preview so they are not marked as failed.
        if (!record.content?.serverKey) {
            continue;
        }
        // 已有生成中 / 失败状态时不再自动触发（失败需手动重试）。
        if (props.service.previewStatus(id)) {
            continue;
        }
        props.service
            .generatePreview(record, previewTextOf(record), () => {
                void loadRecords();
            })
            .catch(() => {
                // 失败状态已记录，卡片展示重试入口。
            });
    }
};

const doRetryPreview = async (record: VoiceRecord) => {
    await props.service.generatePreview(record, previewTextOf(record), () => {
        void loadRecords();
    });
    if (props.service.previewStatus(record.id as number) === "failed") {
        Dialog.tipError(
            props.service.previewError(record.id as number) ||
                t("voice.previewFailed"),
        );
    }
};

const doRefresh = async () => {
    loading.value = true;
    await loadRecords();
    loading.value = false;
    ensurePreviews();
};

onMounted(async () => {
    await doRefresh();
    
});

onUnmounted(() => {
    
});

const onChangeTitle = async (record: VoiceRecord, value: string) => {
    await props.service.update(record.id as number, { title: value });
    await doRefresh();
};

const doDelete = async (record: VoiceRecord) => {
    await Dialog.confirm(t("common.deleteConfirm"));
    await props.service.delete(record);
    await doRefresh();
};

const voiceTypeLabel = (record: VoiceRecord) => {
    return record.content?.type === "clone"
        ? t("voice.typeClone")
        : t("voice.typeTts");
};
</script>

<template>
    <div class="p-5">
        <PageHeader :title="$t(titleKey)" :desc="descKey ? $t(descKey) : ''" />
        <ListerTop
            :loading="loading"
            :total="records.length"
            @refresh="doRefresh"
        >
            <template #actions>
                <a-button @click="editDialog?.add()">
                    <template #icon>
                        <i-mdi-plus />
                    </template>
                    {{ $t("common.add") }}
                </a-button>
            </template>
        </ListerTop>
        <div>
            <m-empty v-if="!records.length && !loading" />
            <m-loading v-else-if="!records.length && loading" page />
            <div v-for="r in records" :key="r.id">
                <div class="rounded-xl shadow border p-4 mb-3 hover:shadow-lg">
                    <div class="flex items-center mb-3">
                        <div class="flex-grow w-0 mr-2">
                            <div
                                class="inline-flex max-w-full items-center bg-blue-100 rounded-full px-2 leading-8 h-8"
                            >
                                <div
                                    class="truncate overflow-hidden flex-grow min-w-0"
                                >
                                    {{ r.title }}
                                </div>
                                <InputInlineEditor
                                    :value="r.title"
                                    @change="onChangeTitle(r, $event)"
                                >
                                    <a
                                        class="ml-1 text-gray-400 flex-shrink-0 whitespace-nowrap block"
                                        href="javascript:;"
                                    >
                                        <icon-pen />
                                    </a>
                                </InputInlineEditor>
                            </div>
                        </div>
                        <div>
                            <a-button class="mr-2" @click="editDialog?.edit(r)">
                                <template #icon>
                                    <icon-edit />
                                </template>
                            </a-button>
                            <a-button @click="doDelete(r)" status="danger">
                                <template #icon>
                                    <icon-delete />
                                </template>
                            </a-button>
                        </div>
                    </div>
                    <div class="flex items-center flex-wrap gap-1">
                        <div
                            class="inline-flex items-center bg-gray-100 rounded-lg px-2 leading-6 h-6 text-xs"
                        >
                            <i-mdi-account-voice
                                class="w-4 h-4 inline-block align-middle mr-1"
                            />
                            {{ voiceTypeLabel(r) }}
                        </div>
                        <div
                            v-if="r.content?.serverKey"
                            class="inline-flex items-center bg-gray-100 rounded-lg px-2 leading-6 h-6 text-xs"
                        >
                            <i-mdi-server-outline
                                class="w-4 h-4 inline-block align-middle mr-1"
                            />
                            {{ r.content?.serverTitle }}
                            v{{ r.content?.serverVersion }}
                        </div>
                        <div
                            v-else
                            class="inline-flex items-center bg-red-100 text-red-600 rounded-lg px-2 leading-6 h-6 text-xs"
                            :title="$t('soundVoice.modelNotSetHint')"
                        >
                            <i-mdi-alert-circle-outline
                                class="w-4 h-4 inline-block align-middle mr-1"
                            />
                            {{ $t("soundVoice.modelNotSet") }}
                        </div>
                        <div
                            v-if="
                                r.content?.type === 'tts' &&
                                r.content?.param?.speaker
                            "
                            class="inline-flex items-center bg-gray-100 rounded-lg px-2 leading-6 h-6 text-xs"
                        >
                            <i-mdi-speaker
                                class="w-4 h-4 inline-block align-middle mr-1"
                            />
                            {{ r.content.param.speaker }}
                        </div>
                        <div
                            v-if="
                                r.content?.type === 'clone' &&
                                r.content?.promptText
                            "
                            class="inline-flex items-center bg-gray-100 rounded-lg px-2 leading-6 h-6 text-xs"
                        >
                            <i-mdi-comment-text-outline
                                class="w-4 h-4 inline-block align-middle mr-1"
                            />
                            {{ r.content.promptText }}
                        </div>
                    </div>
                    <div v-if="r.content?.previewUrl" class="pt-3">
                        <AudioPlayer
                            show-wave
                            :url="'file://' + r.content.previewUrl"
                        />
                    </div>
                    <div
                        v-else-if="service.previewStatus(r.id) === 'generating'"
                        class="pt-3 flex items-center text-gray-400 text-sm"
                    >
                        <icon-loading class="mr-2 animate-spin" />
                        {{ $t("voice.previewGenerating") }}
                    </div>
                    <div
                        v-else-if="service.previewStatus(r.id) === 'failed'"
                        class="pt-3 flex items-center text-gray-400 text-sm"
                    >
                        <icon-exclamation-circle
                            class="text-red-500 mr-2 flex-shrink-0"
                        />
                        <span
                            class="truncate"
                            :title="service.previewError(r.id)"
                        >
                            {{ $t("voice.previewFailed") }}
                            <template v-if="service.previewError(r.id)">
                                （{{ service.previewError(r.id) }}）
                            </template>
                        </span>
                        <a
                            class="ml-2 text-blue-500 flex-shrink-0"
                            href="javascript:;"
                            @click="doRetryPreview(r)"
                        >
                            {{ $t("voice.previewRetry") }}
                        </a>
                    </div>
                </div>
            </div>
        </div>
        <VoiceEditDialog
            ref="editDialog"
            :service="service"
            @update="doRefresh"
        />
    </div>
</template>
