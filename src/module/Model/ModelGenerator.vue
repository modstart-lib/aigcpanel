<script setup lang="ts">
import ModelSelector from "./ModelSelector.vue";
import {onMounted, ref, watch} from "vue";
import {StorageUtil} from "../../lib/storage";
import {useModelStore} from "./store/model";
import {StringUtil} from "../../lib/util";
import {ModelChatResult} from "./provider/provider";
import {t} from "../../lang";
import {ChatParam} from "./types";

const modelStore = useModelStore();
const selectedModel = ref<string>("");
const props = defineProps({
    biz: {
        type: String,
        default: "",
    },
});
watch(selectedModel, newValue => {
    if (props.biz) {
        StorageUtil.set(`ModelGenerator.${props.biz}`, newValue);
    }
});
onMounted(() => {
    if (props.biz) {
        selectedModel.value = StorageUtil.get(`ModelGenerator.${props.biz}`, "");
    }
});

const chat = async (
    prompt: string,
    chatParam: ChatParam,
    param?: Record<string, any>,
    option?: {
        format?: "text" | "json";
    }
): Promise<ModelChatResult> => {
    option = Object.assign({
        format: "text",
    }, option);
    if (param) {
        prompt = StringUtil.replaceParam(prompt, param);
        if (chatParam.systemPrompt) {
            chatParam.systemPrompt = StringUtil.replaceParam(chatParam.systemPrompt, param);
        }
    }
    const [providerId, modelId] = (selectedModel.value || "|").split("|");
    const ret = await modelStore.chat(providerId, modelId, prompt, chatParam);
    if (ret.code) {
        return ret;
    }
    if (option.format === 'json') {
        let content = ret.data!.content;
        if (!content) {
            ret.code = -1;
            ret.msg = t("error.responseEmpty");
            return ret;
        }
        content = content.trim();
        // ```json xxx ``` replace
        if (/^```json/.test(content)) {
            content = content.replace(/^```json/, '').replace(/```$/, '').trim();
        } else if (/^```/.test(content)) {
            content = content.replace(/^```/, '').replace(/```$/, '').trim();
        }
        try {
            ret.data!.json = JSON.parse(content);
        } catch (e) {
            ret.code = -1;
            ret.msg = t("error.parseFailed") + ':' + content;
        }
    }
    return ret;
};
defineExpose({
    chat,
});
</script>

<template>
    <ModelSelector v-model="selectedModel"/>
</template>
