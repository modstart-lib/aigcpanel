<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import AudioPlayer from "../common/AudioPlayer.vue";
import ParamForm from "../common/ParamForm.vue";
import ServerSelector from "../Server/ServerSelector.vue";
import ServerContentInfoAction from "../Server/ServerContentInfoAction.vue";
import WebFileSelectButton from "../common/WebFileSelectButton.vue";
import { Dialog } from "../../lib/dialog";
import { t } from "../../lang";
import { AudioUtil } from "../../lib/audio";
import { DataService } from "../../service/DataService";
import {
    VoiceContent,
    VoiceRecord,
    VoiceServiceType,
} from "../../service/VoiceService";
import { useServerStore } from "../../store/modules/server";

const props = defineProps<{
    service: VoiceServiceType;
    /** 管理入口的文案 key（用于标题/按钮） */
    titleKey?: string;
}>();

const serverStore = useServerStore();
const visible = ref(false);
const editingId = ref(0);
const saving = ref(false);
const formData = ref({
    title: "",
    type: "tts" as "tts" | "clone",
    serverKey: "",
    promptText: "",
    previewText: t("voice.previewDefault"),
});
const paramForm = ref<InstanceType<typeof ParamForm> | null>(null);
const audioPlayer = ref<InstanceType<typeof AudioPlayer> | null>(null);
const previewPlayer = ref<InstanceType<typeof AudioPlayer> | null>(null);
const paramDef = ref<any[]>([]);
const serverConfig = ref<any>(null);
const previewUrl = ref("");
const previewLoading = ref(false);
const existingPromptUrl = ref("");
const pendingParam = ref<Record<string, any> | null>(null);

const funcName = () => {
    return formData.value.type === "clone" ? "soundClone" : "soundTts";
};

/**
 * Extension to keep for an uploaded reference file. Only wav/mp3 are accepted
 * (matching the upload filter); anything else returns "" so we fall back to
 * re-encoding instead of mislabeling the bytes.
 */
const originalFileExt = (name: string) => {
    const m = /\.([a-z0-9]+)$/i.exec(name || "");
    const ext = m ? m[1].toLowerCase() : "";
    return ext === "wav" || ext === "mp3" ? ext : "";
};

const onServerUpdate = (config: any) => {
    serverConfig.value = config;
    paramDef.value = config?.functions?.[funcName()]?.param || [];
};

// 用户切换类型时重置模型与参数（编辑回填不经过此处，避免覆盖）
const onTypeChange = () => {
    formData.value.serverKey = "";
    serverConfig.value = null;
    paramDef.value = [];
    previewUrl.value = "";
};

watch(paramDef, async (def) => {
    if (pendingParam.value && def) {
        await nextTick();
        paramForm.value?.setValue(pendingParam.value);
        pendingParam.value = null;
    }
});

// Stop the preview / reference audio playback when the dialog is closed.
watch(visible, (val) => {
    if (!val) {
        previewPlayer.value?.doStop();
        audioPlayer.value?.doStop();
    }
});

const reset = () => {
    editingId.value = 0;
    formData.value.title = "";
    formData.value.type = "tts";
    formData.value.serverKey = "";
    formData.value.promptText = "";
    formData.value.previewText = t("voice.previewDefault");
    paramDef.value = [];
    serverConfig.value = null;
    previewUrl.value = "";
    existingPromptUrl.value = "";
    pendingParam.value = null;
};

const add = () => {
    reset();
    visible.value = true;
};

const edit = async (record: VoiceRecord) => {
    reset();
    editingId.value = record.id as number;
    formData.value.title = record.title || "";
    formData.value.type = record.content?.type || "tts";
    formData.value.serverKey = record.content?.serverKey || "";
    formData.value.promptText = record.content?.promptText || "";
    previewUrl.value = record.content?.previewUrl || "";
    formData.value.previewText =
        record.content?.previewText || t("voice.previewDefault");
    existingPromptUrl.value = record.content?.promptUrl || "";
    pendingParam.value =
        record.content?.type === "tts" ? record.content?.param || {} : null;
    visible.value = true;
};

const onSelectFile = async (file: any) => {
    await audioPlayer.value?.setRecordFromFile(file);
};

const buildContent = async (): Promise<VoiceContent | null> => {
    if (!formData.value.serverKey) {
        Dialog.tipError(t("voice.serverRequired"));
        return null;
    }
    const server = await serverStore.getByKey(formData.value.serverKey);
    if (!server) {
        Dialog.tipError(t("voice.serverRequired"));
        return null;
    }
    const base = {
        serverKey: formData.value.serverKey,
        serverName: server.name,
        serverTitle: server.title,
        serverVersion: server.version,
        previewUrl: previewUrl.value,
        previewText: formData.value.previewText,
    };
    if (formData.value.type === "clone") {
        if (!formData.value.promptText) {
            Dialog.tipError(t("hint.inputRefText"));
            return null;
        }
        let promptUrl = existingPromptUrl.value;
        const player = audioPlayer.value;
        const sourceFile = player?.getOriginalFile?.();
        const sourceType = player?.getSourceType?.();
        const originalExt = sourceFile ? originalFileExt(sourceFile.name) : "";
        if (sourceFile && originalExt) {
            // Save the uploaded file verbatim to avoid re-encoding quality loss.
            const data = new Uint8Array(await sourceFile.arrayBuffer());
            promptUrl = await DataService.saveBuffer(originalExt, data);
        } else if (sourceType === "record" || sourceType === "trim") {
            // Recorded or trimmed audio: re-encode to wav at the original rate.
            const buffer = player?.getAudioBuffer();
            if (buffer) {
                const wav = AudioUtil.audioBufferToWav(buffer);
                promptUrl = await DataService.saveBuffer("wav", wav);
            }
        }
        if (!promptUrl) {
            Dialog.tipError(t("hint.recordVoice"));
            return null;
        }
        return {
            ...base,
            type: "clone",
            param: paramForm.value ? paramForm.value.getValue() : {},
            promptUrl,
            promptText: formData.value.promptText,
        };
    }
    if (paramForm.value && !paramForm.value.validate()) {
        return null;
    }
    const param = paramForm.value ? paramForm.value.getValue() : {};
    if (!param) {
        Dialog.tipError(t("error.voiceParamInvalid"));
        return null;
    }
    return {
        ...base,
        type: "tts",
        param,
    };
};

const doPreview = async () => {
    if (previewLoading.value) {
        return;
    }
    if (!formData.value.previewText) {
        Dialog.tipError(t("hint.inputText"));
        return;
    }
    previewLoading.value = true;
    try {
        const content = await buildContent();
        if (!content) {
            return;
        }
        const url = await props.service.synthesize(
            {
                id: editingId.value,
                title: formData.value.title,
                content,
            } as VoiceRecord,
            formData.value.previewText,
        );
        previewUrl.value = url;
        await nextTick();
        if (!visible.value) {
            // The dialog was closed while synthesizing, do not auto play.
            return;
        }
        previewPlayer.value?.doPlay();
        Dialog.tipSuccess(t("voice.previewSuccess"));
    } catch (e: any) {
        Dialog.tipError((e && e.message) || String(e));
    } finally {
        previewLoading.value = false;
    }
};

const doSave = async () => {
    if (!formData.value.title) {
        Dialog.tipError(t("hint.inputName"));
        return false;
    }
    const content = await buildContent();
    if (!content) {
        return false;
    }
    saving.value = true;
    try {
        if (editingId.value) {
            await props.service.update(editingId.value, {
                title: formData.value.title,
                content,
            } as any);
        } else {
            await props.service.add({
                title: formData.value.title,
                content,
            });
        }
        Dialog.tipSuccess(t("voice.saveSuccess"));
        visible.value = false;
        emit("update");
        return true;
    } catch (e: any) {
        Dialog.tipError((e && e.message) || String(e));
        return false;
    } finally {
        saving.value = false;
    }
};

defineExpose({
    add,
    edit,
    doSave,
    fill(params: {
        title?: string;
        type?: "tts" | "clone";
        serverKey?: string;
        promptText?: string;
    }) {
        if (params.title !== undefined) formData.value.title = params.title;
        if (params.type !== undefined) formData.value.type = params.type;
        if (params.serverKey !== undefined)
            formData.value.serverKey = params.serverKey;
        if (params.promptText !== undefined)
            formData.value.promptText = params.promptText;
    },
});

const emit = defineEmits({
    update: () => true,
});
</script>

<template>
    <a-modal
        v-model:visible="visible"
        width="min(960px, 95vw)"
        modal-class="voice-edit-dialog"
        title-align="start"
    >
        <template #title>
            {{ editingId ? $t("voice.edit") : $t("voice.add") }}
        </template>
        <template #footer>
            <a-button @click="visible = false">
                {{ $t("common.cancel") }}
            </a-button>
            <a-button type="primary" :loading="saving" @click="doSave">
                {{ $t("common.save") }}
            </a-button>
        </template>
        <div>
            <div
                class="grid gap-5"
                style="grid-template-columns: minmax(0, 2fr) minmax(0, 1fr)"
            >
                <div class="min-w-0">
                    <a-form :model="{}" layout="vertical">
                        <a-form-item :label="$t('common.name')" required>
                            <a-input
                                v-model="formData.title"
                                :placeholder="$t('voice.namePlaceholder')"
                            />
                        </a-form-item>
                        <a-form-item :label="$t('voice.type')">
                            <a-radio-group
                                v-model="formData.type"
                                @change="onTypeChange"
                            >
                                <a-radio value="tts">
                                    <i-mdi-text-to-speech
                                        class="w-4 h-4 inline-block align-middle"
                                    />
                                    {{ $t("voice.typeTts") }}
                                </a-radio>
                                <a-radio value="clone">
                                    <i-mdi-account-voice
                                        class="w-4 h-4 inline-block align-middle"
                                    />
                                    {{ $t("voice.typeClone") }}
                                </a-radio>
                            </a-radio-group>
                        </a-form-item>
                        <a-form-item :label="$t('voice.model')" required>
                            <div class="flex flex-wrap items-center gap-2">
                                <ServerSelector
                                    v-model="formData.serverKey"
                                    :function-name="funcName()"
                                    @update="onServerUpdate"
                                />
                                <ServerContentInfoAction
                                    :config="serverConfig"
                                    :func="funcName()"
                                />
                            </div>
                        </a-form-item>
                        <a-form-item
                            v-if="formData.type === 'clone'"
                            :label="$t('voice.referenceAudio')"
                            required
                        >
                            <div class="w-full">
                                <div class="mb-2">
                                    <a-alert>{{
                                        $t("voice.refAudioGuide1")
                                    }}</a-alert>
                                </div>
                                <AudioPlayer
                                    ref="audioPlayer"
                                    :url="
                                        existingPromptUrl
                                            ? 'file://' + existingPromptUrl
                                            : ''
                                    "
                                    show-wave
                                    trim-enable
                                    record-enable
                                    decode-original-rate
                                />
                                <div
                                    class="mt-2 text-gray-400 flex items-center text-sm"
                                >
                                    <div class="flex-grow">
                                        <icon-info-circle />
                                        {{ $t("hint.audioFormat") }}
                                    </div>
                                    <WebFileSelectButton
                                        @select-file="onSelectFile"
                                        accept="audio/wav,audio/mp3"
                                    >
                                        <a-button>
                                            <template #icon>
                                                <icon-upload />
                                            </template>
                                            {{ $t("voice.selectFile") }}
                                        </a-button>
                                    </WebFileSelectButton>
                                </div>
                            </div>
                        </a-form-item>
                        <a-form-item
                            v-if="formData.type === 'clone'"
                            :label="$t('voice.referenceText')"
                            required
                        >
                            <a-input
                                v-model="formData.promptText"
                                :placeholder="$t('voice.refTextPlaceholder')"
                            />
                        </a-form-item>
                        <a-form-item
                            v-if="
                                formData.type === 'tts' && paramDef.length > 0
                            "
                            :label="$t('voice.param')"
                        >
                            <ParamForm ref="paramForm" :param="paramDef" />
                        </a-form-item>
                        <a-form-item :label="$t('voice.previewText')">
                            <div class="flex items-center w-full">
                                <a-input
                                    v-model="formData.previewText"
                                    class="flex-grow"
                                />
                                <a-button
                                    class="ml-2 flex-shrink-0"
                                    type="primary"
                                    status="success"
                                    :loading="previewLoading"
                                    @click="doPreview"
                                >
                                    <template #icon>
                                        <icon-play-arrow />
                                    </template>
                                    {{ $t("voice.preview") }}
                                </a-button>
                            </div>
                        </a-form-item>
                        <a-form-item v-if="previewUrl">
                            <AudioPlayer
                                ref="previewPlayer"
                                show-wave
                                :url="'file://' + previewUrl"
                            />
                        </a-form-item>
                    </a-form>
                </div>
                <div class="min-w-0">
                    <div class="text-lg font-bold">
                        {{ $t("voice.timbreDesc") }}
                    </div>
                    <div
                        class="bg-gray-100 mt-2 p-3 rounded-lg leading-6 text-xs"
                    >
                        <template v-if="formData.type === 'clone'">
                            <div>{{ $t("guide.audioReq1") }}</div>
                            <div>{{ $t("guide.audioReq2") }}</div>
                            <div>{{ $t("guide.audioReq3") }}</div>
                            <div>{{ $t("guide.audioReq4") }}</div>
                            <div class="mt-2">
                                {{ $t("voice.guideCloneText") }}
                            </div>
                            <div class="mt-2">
                                {{ $t("voice.refTextRequired") }}
                            </div>
                        </template>
                        <template v-else>
                            <div>{{ $t("voice.guideTts1") }}</div>
                            <div>{{ $t("voice.guideTts2") }}</div>
                            <div>{{ $t("voice.guideTts3") }}</div>
                        </template>
                    </div>
                </div>
            </div>
        </div>
    </a-modal>
</template>
