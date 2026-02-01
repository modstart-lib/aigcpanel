<script setup lang="ts">
import ModelGenerator from "./ModelGenerator.vue";
import {ref} from "vue";
import {t} from "../../lang";
import {Dialog} from "../../lib/dialog";
import {getDataContent} from "../../components/common/dataConfig";

export type ModelGenerateButtonOptionType = {
    mode: 'once' | 'repeat',
    promptDefault: string,
    promptSystem: string,
    onResult: (result: string, param: Record<string, any>) => Promise<void>,
    onStart?: () => Promise<void>,
    onEnd?: () => Promise<void>,
    onGetParam?: () => Promise<Record<string, any> | null>
}

const props = withDefaults(defineProps<{
    biz: string,
    title: string,
    option: ModelGenerateButtonOptionType,
}>(), {
    title: t('common.aiGenerated'),
    mode: 'once',
});
const modelGenerator = ref<InstanceType<typeof ModelGenerator> | null>(null);
const replyGenerateLoading = ref(false);
const doGenerateReply = async () => {
    if (!modelGenerator.value) {
        Dialog.tipError(t("hint.selectModelFirst"));
        return;
    }
    replyGenerateLoading.value = true;
    let prompt = await getDataContent(props.biz, props.option.promptDefault);
    if (!prompt) {
        Dialog.tipError(t("hint.configPromptFirst"));
        replyGenerateLoading.value = false;
        return;
    }
    if (props.option.mode === 'repeat' && !props.option.onGetParam) {
        Dialog.tipError('onGetParam missing');
        return;
    }
    const chatParam = {
        systemPrompt: props.option.promptSystem,
    }
    try {
        if (props.option.onStart) {
            await props.option.onStart();
        }
        if ('once' === props.option.mode) {
            let param = {};
            if (props.option.onGetParam) {
                param = await props.option.onGetParam() || {};
            }
            const ret = await modelGenerator.value.chat(prompt, chatParam, param);
            if (ret.code) {
                Dialog.tipError(ret.msg);
                return;
            }
            await props.option.onResult(ret.data?.content!, param);
        } else if ('repeat' === props.option.mode) {
            for (let i = 0; i < 10000; i++) {
                let param = await props.option.onGetParam!();
                if (null === param) {
                    break;
                }
                const ret = await modelGenerator.value.chat(prompt, chatParam, param);
                if (ret.code) {
                    Dialog.tipError(ret.msg);
                    return;
                }
                await props.option.onResult(ret.data?.content!, param);
            }
        }
    } catch (e) {
        console.error(e);
        Dialog.tipError(t("common.generateFailed") + ":" + e);
    } finally {
        if (props.option.onEnd) {
            await props.option.onEnd();
        }
        replyGenerateLoading.value = false;
    }
};
</script>

<template>
    <ModelGenerator ref="modelGenerator" :biz="biz"/>
    <a-button size="small" class="mr-1"
              @click="doGenerateReply"
              :loading="replyGenerateLoading">
        <template #icon>
            <icon-robot/>
        </template>
        {{ title }}
    </a-button>
</template>

