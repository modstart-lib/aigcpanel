<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import ServerContentInfoAction from "../Server/ServerContentInfoAction.vue";
import {
    VOICE_BIZ_LIVE,
    VoiceRecord,
    VoiceServiceType,
} from "../../service/VoiceService";
import { useServerStore } from "../../store/modules/server";
import { EnumServerType } from "../../types/Server";
import Router from "../../router";

const props = withDefaults(
    defineProps<{
        service: VoiceServiceType;
        modelValue: number;
        disabled?: boolean;
        placeholder?: string;
    }>(),
    {
        disabled: false,
        placeholder: "",
    },
);

const emit = defineEmits(["update:modelValue", "model-config"]);

const goManage = () => {
    Router.push({
        path: props.service.biz === VOICE_BIZ_LIVE ? "/live" : "/video",
        query: { tab: "voice" },
    });
};

const serverStore = useServerStore();
const records = ref<VoiceRecord[]>([]);
const modelConfig = ref<any>(null);
const modelFunction = ref("");
const doRefresh = async () => {
    records.value = await props.service.list();
};

watch(
    () => props.modelValue,
    async (voiceId, _, onCleanup) => {
        modelConfig.value = null;
        modelFunction.value = "";
        emit("model-config", null);
        if (!voiceId) return;
        let stale = false;
        onCleanup(() => {
            stale = true;
        });
        try {
            const voice = await props.service.get(voiceId);
            if (!voice?.content || stale) return;
            if (!voice.content.serverKey) return;
            const server = await serverStore.getByKey(voice.content.serverKey);
            if (!server || stale) return;
            let config: any = server;
            if (server.type !== EnumServerType.CLOUD) {
                try {
                    const res = await window.$mapi.server.config(
                        await serverStore.serverInfo(server),
                    );
                    if (!res.code) config = res.data;
                } catch {
                    // 使用已缓存的模型信息。
                }
            }
            if (stale) return;
            modelConfig.value = config;
            modelFunction.value =
                voice.content.type === "clone" ? "soundClone" : "soundTts";
            emit("model-config", {
                config: modelConfig.value,
                functionName: modelFunction.value,
            });
        } catch {
            // 模型说明是附加信息，读取失败时仍允许选择音色。
        }
    },
    { immediate: true },
);

onMounted(async () => {
    await doRefresh();
});

defineExpose({ refresh: doRefresh });
</script>

<template>
    <div class="flex items-center gap-2">
        <a-select
            :model-value="modelValue || undefined"
            :disabled="disabled"
            :placeholder="placeholder"
            style="width: 15em"
            @change="emit('update:modelValue', $event as number)"
        >
            <a-option v-for="v in records" :key="v.id" :value="v.id">
                {{ v.title }}
            </a-option>
        </a-select>
        <ServerContentInfoAction :config="modelConfig" :func="modelFunction" />
        <slot name="actions" />
        <a-button @click="goManage">
            <template #icon>
                <icon-settings />
            </template>
            {{ $t("voice.timbreManage") }}
        </a-button>
    </div>
</template>
