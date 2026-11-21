<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import ParamForm from "../../../components/common/ParamForm.vue";
import ServerContentInfoAction from "../../../components/Server/ServerContentInfoAction.vue";
import ServerSelector from "../../../components/Server/ServerSelector.vue";
import { t } from "../../../lang";
import { Dialog } from "../../../lib/dialog";
import { StorageUtil } from "../../../lib/storage";
import VoiceSelector from "../../../components/Voice/VoiceSelector.vue";
import { SoundVoiceService } from "../../../service/VoiceService";
import { useServerStore } from "../../../store/modules/server";
import { EnumServerStatus } from "../../../types/Server";

const props = withDefaults(defineProps<{ voiceSelectOnly?: boolean }>(), {
    voiceSelectOnly: false,
});

const serverStore = useServerStore();
const formData = ref({
    type: "SoundTts",
    ttsServerKey: "",
    cloneVoiceId: 0,
    voiceId: 0,
});
const ttsParamForm = ref<InstanceType<typeof ParamForm>>();
const ttsParam = ref([]);
const ttsModelConfig = ref(null);
const voiceEmpty = ref(false);
/** Param definitions of the selected voice's model (voiceSelectOnly mode). */
const voiceParamDef = ref<any[]>([]);
const voiceParamForm = ref<InstanceType<typeof ParamForm>>();
/** True when the selected voice has no model bound yet (e.g. migrated legacy voices). */
const voiceModelNotSet = ref(false);
/** Per-synthesis param editor visibility (collapsed by default). */
const voiceParamExpanded = ref(false);
/** Voice params to apply to the param form once it is ready. */
const voiceParamPending = ref<Record<string, any> | null>(null);
const onSoundTtsServerUpdate = async (config: any) => {
    ttsParam.value = config.functions.soundTts?.param || [];
    ttsModelConfig.value = config;
};

/**
 * The selected voice resolved its model config: render the model's param form
 * so the user can tweak params (speaker/speed/...) per synthesis, while the
 * model itself stays bound to the voice. The params default to the voice's own
 * saved params.
 */
const onVoiceModelConfig = async (payload: any) => {
    const def = payload?.config?.functions?.[payload.functionName]?.param || [];
    voiceParamDef.value = def;
    if (!def.length) {
        voiceParamPending.value = null;
        return;
    }
    const voice = await SoundVoiceService.get(formData.value.voiceId);
    voiceParamPending.value = (voice?.content?.param as any) || {};
};

// Apply the pending params once both the param definitions and the param form
// are ready (post-flush so the form is mounted before setValue runs). The
// pending value is set asynchronously (after fetching the voice), so it is a
// watch source too.
watch(
    [voiceParamDef, voiceParamForm, voiceParamPending],
    () => {
        if (
            !voiceParamPending.value ||
            !voiceParamDef.value.length ||
            !voiceParamForm.value
        ) {
            return;
        }
        const pending = voiceParamPending.value;
        voiceParamPending.value = null;
        voiceParamForm.value.setValue(pending);
    },
    { flush: "post" },
);

const refreshVoiceEmpty = async () => {
    voiceEmpty.value = (await SoundVoiceService.list()).length === 0;
};

onMounted(async () => {
    const old = StorageUtil.getObject("SoundGenerateForm.formData");
    formData.value.type = old.type || "SoundTts";
    formData.value.ttsServerKey = old.ttsServerKey || "";
    formData.value.cloneVoiceId = old.cloneVoiceId || 0;
    formData.value.voiceId = old.voiceId || 0;
    await refreshVoiceEmpty();
});
watch(
    () => formData.value,
    async (value) => {
        StorageUtil.set("SoundGenerateForm.formData", value);
    },
    {
        deep: true,
    },
);

// Track whether the selected voice has a model bound; migrated legacy voices
// have none and need the user to set one in the voice management page.
watch(
    () => formData.value.voiceId,
    async (id) => {
        voiceModelNotSet.value = false;
        voiceParamExpanded.value = false;
        if (!id) {
            return;
        }
        const voice = await SoundVoiceService.get(id);
        voiceModelNotSet.value =
            !!voice && !!voice.content && !voice.content.serverKey;
    },
);

const getValue = async (): Promise<SoundGenerateParamType | undefined> => {
    if (props.voiceSelectOnly) {
        const voice = await SoundVoiceService.get(formData.value.voiceId);
        if (!voice || !voice.content) {
            Dialog.tipError(t("soundVoice.selectRequired"));
            return;
        }
        if (!voice.content.serverKey) {
            Dialog.tipError(t("soundVoice.modelNotSetHint"));
            return;
        }
        const server = await serverStore.getByNameVersion(
            voice.content.serverName,
            voice.content.serverVersion,
        );
        if (!server) {
            Dialog.tipError(t("hint.selectVoiceModel"));
            return;
        }
        if (server.status !== EnumServerStatus.RUNNING) {
            Dialog.tipError(t("error.voiceModelNotStarted"));
            return;
        }
        if (voice.content.type === "clone" && voice.content.promptUrl) {
            const promptUrl = voice.content.promptUrl;
            if (
                !/^https?:\/\//i.test(promptUrl) &&
                !(await window.$mapi.file.exists(promptUrl))
            ) {
                Dialog.tipError(t("sound.timbreAudioNotFound"));
                return;
            }
        }
        const config: any = SoundVoiceService.buildModelConfig(voice, "");
        // Params can be tweaked per synthesis; the model stays bound to the voice.
        if (voiceParamDef.value.length > 0 && voiceParamForm.value) {
            if (!voiceParamForm.value.validate()) {
                return;
            }
            const param = voiceParamForm.value.getValue();
            if (config.type === "SoundClone") {
                config.cloneParam = param;
            } else {
                config.ttsParam = param;
            }
        }
        return {
            ...config,
            voiceId: voice.id as number,
            serverName: server.name,
            serverTitle: server.title,
            serverVersion: server.version,
            promptTitle: voice.title,
        };
    }
    const data: any = {};
    data.type = formData.value.type;
    if (!data.type) {
        Dialog.tipError(t("hint.selectSynthesisType"));
        return;
    }
    if (data.type === "SoundTts") {
        data.ttsServerKey = formData.value.ttsServerKey;
        const server = await serverStore.getByKey(data.ttsServerKey);
        if (!server) {
            Dialog.tipError(t("hint.selectVoiceModel"));
            return;
        }
        if (server.status !== EnumServerStatus.RUNNING) {
            Dialog.tipError(t("error.voiceModelNotStarted"));
            return;
        }
        data.serverName = server.name;
        data.serverTitle = server.title;
        data.serverVersion = server.version;
        data.ttsParam = ttsParamForm.value ? ttsParamForm.value.getValue() : {};
        if (!data.ttsParam) {
            Dialog.tipError(t("error.voiceParamInvalid"));
            return;
        }
        if (ttsParamForm.value) {
            if (!ttsParamForm.value.validate()) {
                return;
            }
        }
    } else if (data.type === "SoundClone") {
        data.cloneVoiceId = formData.value.cloneVoiceId;
        const voice = await SoundVoiceService.get(data.cloneVoiceId);
        if (!voice) {
            Dialog.tipError(t("soundVoice.selectRequired"));
            return;
        }
        if (voice.content?.type !== "clone") {
            Dialog.tipError(t("soundVoice.cloneRequired"));
            return;
        }
        const server = await serverStore.getByNameVersion(
            voice.content.serverName,
            voice.content.serverVersion,
        );
        if (!server) {
            Dialog.tipError(t("hint.selectVoiceModel"));
            return;
        }
        if (server.status !== EnumServerStatus.RUNNING) {
            Dialog.tipError(t("error.voiceModelNotStarted"));
            return;
        }
        data.cloneServerKey = voice.content.serverKey;
        data.serverName = server.name;
        data.serverTitle = server.title;
        data.serverVersion = server.version;
        data.cloneParam = voice.content.param || {};
        data.promptId = 0;
        data.promptTitle = voice.title;
        data.promptUrl = voice.content.promptUrl;
        data.promptText = voice.content.promptText;
        if (data.promptUrl && !data.promptUrl.startsWith("http")) {
            if (!(await window.$mapi.file.exists(data.promptUrl))) {
                Dialog.tipError(t("sound.timbreAudioNotFound"));
                return;
            }
        }
    }
    return data;
};

const setValue = (data: Partial<SoundGenerateParamType>) => {
    if (data.voiceId !== undefined) {
        formData.value.voiceId = data.voiceId;
    }
    if (data.type !== undefined) {
        formData.value.type = data.type;
    }
    if (data.ttsServerKey !== undefined) {
        formData.value.ttsServerKey = data.ttsServerKey;
    }
    if ((data as any).cloneVoiceId !== undefined) {
        formData.value.cloneVoiceId = (data as any).cloneVoiceId;
    }
    if (data.ttsParam !== undefined) {
        ttsParamForm.value?.setValue(data.ttsParam);
    }
};

defineExpose({
    getValue,
    setValue,
});
</script>

<template>
    <div class="mb-4">
        <div class="font-bold mb-2">
            <div class="inline-block w-5">
                <icon-settings />
            </div>
            {{ $t("voice.synthesisConfig") }}
        </div>
        <template v-if="voiceSelectOnly">
            <div class="flex items-start min-h-8">
                <div class="mr-1 pt-2">
                    <a-tooltip :content="$t('soundVoice.title')" mini>
                        <i-mdi-microphone class="w-4 h-4" />
                    </a-tooltip>
                </div>
                <div class="flex flex-wrap items-center gap-1">
                    <VoiceSelector
                        v-model="formData.voiceId"
                        :service="SoundVoiceService"
                        :placeholder="$t('soundVoice.select')"
                        @model-config="onVoiceModelConfig"
                    >
                        <template #actions>
                            <a-button
                                v-if="voiceParamDef.length > 0"
                                :type="
                                    voiceParamExpanded ? 'primary' : undefined
                                "
                                @click="
                                    voiceParamExpanded = !voiceParamExpanded
                                "
                            >
                                <template #icon>
                                    <i-mdi-tune-variant />
                                </template>
                                {{ $t("voice.adjustParam") }}
                            </a-button>
                        </template>
                    </VoiceSelector>
                    <div v-if="voiceEmpty" class="text-gray-400 text-sm">
                        {{ $t("soundVoice.empty") }}
                    </div>
                    <div v-if="voiceModelNotSet" class="text-red-500 text-sm">
                        {{ $t("soundVoice.modelNotSetHint") }}
                    </div>
                </div>
            </div>
            <!-- Params default to the voice's own params and are collapsed until
                 the user clicks "Adjust Params". -->
            <div
                v-if="voiceParamDef.length > 0"
                v-show="voiceParamExpanded"
                class="flex items-start mt-2"
            >
                <div class="pt-3 w-5 flex-shrink-0">
                    <a-tooltip :content="$t('voice.param')" mini>
                        <i-mdi-tune-variant class="w-4 h-4" />
                    </a-tooltip>
                </div>
                <div class="flex-grow min-w-0">
                    <ParamForm ref="voiceParamForm" :param="voiceParamDef" />
                </div>
            </div>
            <div class="mt-2"><slot /></div>
        </template>
        <template v-else>
            <div class="flex items-start min-h-8">
                <div class="mr-1">
                    <a-tooltip :content="$t('task.synthesisType')" mini>
                        <i-mdi-volume-high class="w-4 h-4" />
                    </a-tooltip>
                </div>
                <div class="mr-1">
                    <a-radio-group v-model="formData.type">
                        <a-radio value="SoundTts">
                            <i-mdi-text-to-speech
                                class="w-4 h-4 inline-block align-middle"
                            />
                            {{ $t("voice.synthesis") }}
                        </a-radio>
                        <a-radio value="SoundClone">
                            <i-mdi-account-voice
                                class="w-4 h-4 inline-block align-middle"
                            />
                            {{ $t("voice.clone") }}
                        </a-radio>
                    </a-radio-group>
                </div>
            </div>
            <div
                v-if="formData.type === 'SoundTts'"
                class="flex items-start min-h-8"
            >
                <div class="mr-1 pt-2">
                    <a-tooltip :content="$t('voice.synthesisModel')" mini>
                        <i-mdi-server-outline class="w-4 h-4" />
                    </a-tooltip>
                </div>
                <div class="flex flex-wrap gap-1">
                    <div>
                        <ServerSelector
                            v-model="formData.ttsServerKey"
                            @update="onSoundTtsServerUpdate"
                            functionName="soundTts"
                        />
                    </div>
                    <div>
                        <ServerContentInfoAction
                            :config="ttsModelConfig as any"
                            func="soundTts"
                        />
                    </div>
                </div>
            </div>
            <div
                v-if="formData.type === 'SoundClone'"
                class="flex items-start min-h-8 gap-1"
            >
                <div class="mr-1 pt-2">
                    <a-tooltip :content="$t('soundVoice.title')" mini>
                        <i-mdi-microphone class="w-4 h-4" />
                    </a-tooltip>
                </div>
                <div class="flex flex-wrap gap-1 items-center">
                    <VoiceSelector
                        v-model="formData.cloneVoiceId"
                        :service="SoundVoiceService"
                        :placeholder="$t('soundVoice.select')"
                    />
                    <div v-if="voiceEmpty" class="text-gray-400 text-sm">
                        {{ $t("soundVoice.empty") }}
                    </div>
                </div>
            </div>
            <!-- 用户输入信息（文本、图片等）插入 Server 选择与自定义参数之间 -->
            <div class="mt-2">
                <slot />
            </div>
            <div
                class="flex items-start mt-2"
                v-if="formData.type === 'SoundTts' && ttsParam.length > 0"
            >
                <div class="pt-3 w-5 flex-shrink-0">
                    <a-tooltip :content="$t('model.customParam')" mini>
                        <i-mdi-tune-variant class="w-4 h-4" />
                    </a-tooltip>
                </div>
                <div class="flex-grow min-w-0">
                    <ParamForm ref="ttsParamForm" :param="ttsParam" />
                </div>
            </div>
        </template>
    </div>
</template>
