<script setup lang="ts">
import { computed, ref } from "vue";
import { t } from "../../lang";
import { Dialog } from "../../lib/dialog";
import { StringUtil } from "../../lib/util";
import { useServerStore } from "../../store/modules/server";
import { EnumServerType, ServerRecord } from "../../types/Server";

type ApiProviderField = {
    name: string;
    title: string;
    required?: boolean;
    secret?: boolean;
    placeholder?: string;
    defaultValue?: string;
};

type ApiProviderPreset = {
    id: string;
    title: string;
    docs: string;
    defaultTitle: string;
    /** 默认音色（写入 config，不在界面中填写） */
    defaultVoice: string;
    /** 默认接口地址（写入 config，用户可修改） */
    defaultApiUrl: string;
    /** 支持的模型能力 */
    functions: string[];
    fields: ApiProviderField[];
};

const PROVIDERS: ApiProviderPreset[] = [
    {
        id: "volcengine",
        title: "火山引擎（豆包语音）",
        docs: "https://www.volcengine.com/docs/6561/1598757",
        defaultTitle: "火山引擎语音合成",
        defaultVoice: "zh_female_vv_uranus_bigtts",
        defaultApiUrl:
            "https://openspeech.bytedance.com/api/v3/tts/unidirectional",
        functions: ["soundTts"],
        fields: [
            {
                name: "apiKey",
                title: "API Key",
                required: true,
                secret: true,
                placeholder: "豆包语音控制台 API Key（与火山方舟 Key 不通用）",
            },
            {
                name: "apiUrl",
                title: t("model.apiVoiceApiUrl"),
                placeholder:
                    "https://openspeech.bytedance.com/api/v3/tts/unidirectional",
            },
        ],
    },
    {
        id: "aliyun",
        title: "阿里云百炼（DashScope）",
        docs: "https://help.aliyun.com/zh/model-studio/qwen-tts-non-realtime-api",
        defaultTitle: "阿里云百炼语音合成",
        defaultVoice: "Cherry",
        defaultApiUrl:
            "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
        functions: ["soundTts"],
        fields: [
            {
                name: "apiKey",
                title: "API Key",
                required: true,
                secret: true,
                placeholder: "sk-...",
            },
            {
                name: "model",
                title: "模型",
                defaultValue: "qwen3-tts-flash",
                placeholder: "qwen3-tts-flash",
            },
            {
                name: "apiUrl",
                title: t("model.apiVoiceApiUrl"),
                placeholder:
                    "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
            },
        ],
    },
];

const CHECK_TEXT = "你好，这是一段语音试听。";

const serverStore = useServerStore();
const visible = ref(false);
const loading = ref(false);
const providerId = ref(PROVIDERS[0].id);
const title = ref(PROVIDERS[0].defaultTitle);
const values = ref<Record<string, string>>({});

const provider = computed(() => {
    return PROVIDERS.find((p) => p.id === providerId.value) || PROVIDERS[0];
});

const resetValues = () => {
    const v: Record<string, string> = {};
    for (const f of provider.value.fields) {
        if (f.name === "apiUrl") {
            v[f.name] = provider.value.defaultApiUrl;
        } else {
            v[f.name] = f.defaultValue || "";
        }
    }
    values.value = v;
};

const show = (id?: string) => {
    providerId.value =
        id && PROVIDERS.some((p) => p.id === id) ? id : PROVIDERS[0].id;
    title.value = provider.value.defaultTitle;
    resetValues();
    visible.value = true;
};

const onProviderChange = () => {
    title.value = provider.value.defaultTitle;
    resetValues();
};

const openDocs = () => {
    window.$mapi.app.openExternal(provider.value.docs);
};

const buildConfig = (): any | null => {
    for (const f of provider.value.fields) {
        if (f.required && !values.value[f.name]) {
            Dialog.tipError(t("model.apiVoiceRequired", { title: f.title }));
            return null;
        }
    }
    const config: any = Object.assign(
        {
            provider: providerId.value,
            defaultVoice: provider.value.defaultVoice,
            apiUrl: provider.value.defaultApiUrl,
        },
        values.value,
    );
    // 留空时由服务端回退到厂商默认地址
    if (!config.apiUrl) {
        delete config.apiUrl;
    }
    return config;
};

const doSubmit = async () => {
    const config = buildConfig();
    if (!config) {
        return;
    }
    if (!title.value) {
        Dialog.tipError(t("hint.inputName"));
        return;
    }
    loading.value = true;
    try {
        // 先做接口校验，确认密钥可用
        const check = await window.$mapi.server.apiVoiceTest(
            config,
            CHECK_TEXT,
        );
        if (!check || check.code !== 0) {
            Dialog.tipError(
                t("model.apiVoiceCheckFailed", {
                    msg: (check && check.msg) || "",
                }),
            );
            return;
        }
        const name = `api-voice-${providerId.value}-${StringUtil.random(6)}`;
        const funcs = provider.value.functions;
        const methods = {
            soundTts: {
                param: [
                    {
                        name: "speaker",
                        type: "select",
                        title: "音色",
                        defaultValue: provider.value.defaultVoice,
                        options: [
                            {
                                value: provider.value.defaultVoice,
                                label: provider.value.defaultVoice,
                            },
                        ],
                    },
                ],
            },
        } as Record<string, any>;
        await serverStore.add({
            key: serverStore.generateServerKey({
                name,
                version: "1.0.0",
            } as any),
            name,
            title: title.value,
            version: "1.0.0",
            type: EnumServerType.API,
            autoStart: true,
            localPath: name,
            functions: funcs,
            apiConfig: config,
            settings: [],
            setting: {},
            config: {
                name,
                version: "1.0.0",
                title: title.value,
                functions: Object.fromEntries(
                    funcs.map((f) => [f, methods[f] || { param: [] }]),
                ),
                apiConfig: config,
            },
        } as ServerRecord);
        Dialog.tipSuccess(t("model.apiVoiceSaveSuccess"));
        visible.value = false;
        emit("update");
    } catch (e: any) {
        Dialog.tipError((e && e.message) || String(e));
    } finally {
        loading.value = false;
    }
};

defineExpose({
    show,
    fill(params: {
        provider?: string;
        title?: string;
        values?: Record<string, string>;
    }) {
        if (params.provider) {
            providerId.value = params.provider;
            title.value = provider.value.defaultTitle;
            resetValues();
        }
        if (params.title !== undefined) {
            title.value = params.title;
        }
        if (params.values) {
            values.value = Object.assign({}, values.value, params.values);
        }
    },
    doSubmit,
});

const emit = defineEmits({
    update: () => true,
});
</script>

<template>
    <a-modal
        v-model:visible="visible"
        width="min(640px, 95vw)"
        :footer="false"
        :esc-to-close="false"
        :mask-closable="false"
        title-align="start"
    >
        <template #title>
            {{ $t("model.addApiVoice") }}
        </template>
        <div class="p-2">
            <a-form :model="{}" layout="vertical">
                <a-form-item :label="$t('model.apiVoiceProvider')" required>
                    <a-select
                        v-model="providerId"
                        :disabled="loading"
                        @change="onProviderChange"
                    >
                        <a-option
                            v-for="p in PROVIDERS"
                            :key="p.id"
                            :value="p.id"
                        >
                            {{ p.title }}
                        </a-option>
                    </a-select>
                </a-form-item>
                <a-form-item :label="$t('common.name')" required>
                    <a-input v-model="title" :disabled="loading" />
                </a-form-item>
                <a-form-item
                    v-for="f in provider.fields"
                    :key="f.name"
                    :label="f.title"
                    :required="f.required"
                >
                    <a-input-password
                        v-if="f.secret"
                        v-model="values[f.name]"
                        :placeholder="f.placeholder"
                        :disabled="loading"
                        allow-clear
                    />
                    <a-input
                        v-else
                        v-model="values[f.name]"
                        :placeholder="f.placeholder"
                        :disabled="loading"
                        allow-clear
                    />
                    <div
                        v-if="f.name === 'apiUrl'"
                        class="text-gray-400 text-xs mt-1"
                    >
                        {{ $t("model.apiVoiceApiUrlTip") }}
                    </div>
                </a-form-item>
                <div class="text-gray-400 text-sm">
                    <a href="javascript:;" class="text-link" @click="openDocs">
                        {{ $t("model.apiVoiceDocs") }}
                    </a>
                </div>
            </a-form>
            <div class="flex justify-end gap-2 mt-6">
                <a-button @click="visible = false" :disabled="loading">
                    {{ $t("common.cancel") }}
                </a-button>
                <a-button type="primary" :loading="loading" @click="doSubmit">
                    {{ $t("common.confirm") }}
                </a-button>
            </div>
        </div>
    </a-modal>
</template>
