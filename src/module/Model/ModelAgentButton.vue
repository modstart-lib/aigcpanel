<script setup lang="ts">
import {ref, watch} from "vue";
import {t} from "../../lang";
import {Dialog} from "../../lib/dialog";
import ModelGenerator from "./ModelGenerator.vue";

export type ModelAgentButtonFormItems = {
    type: 'text' | 'number' | 'textarea',
    name: string,
    label: string,
    defaultValue?: string | number,
}[]

const props = withDefaults(defineProps<{
    biz: string,
    promptDefault: string,
    systemPrompt:string,
    title: string,
    placeholder: string,
    formItems: ModelAgentButtonFormItems,
}>(), {
    title: t('common.aiGenerated'),
    placeholder: t('hint.inputRequirement'),
    formItems: [] as ModelAgentButtonFormItems,
});

const emit = defineEmits<{
    (e: 'result', result: string): void
}>();


const modelGenerator = ref<InstanceType<typeof ModelGenerator> | null>(null);
const visible = ref(false);
const userInput = ref('');
const userInputForm = ref<Record<string, any>>({});
const loading = ref(false);
const buttonLoading = ref(false);

watch(
    () => props.formItems,
    (newVal) => {
        const form: Record<string, any> = {};
        for (const item of newVal) {
            form[item.name] = item.defaultValue;
        }
        userInputForm.value = form;
    },
    {
        immediate: true,
        deep: true,
    }
);

const showDialog = () => {
    visible.value = true;
};

const doGenerate = async () => {
    if (!modelGenerator.value) {
        Dialog.tipError(t("hint.selectModelFirst"));
        return;
    }
    let prompt = props.promptDefault;
    let replaceParam: Record<string, any> = {};
    if (props.formItems.length > 0) {
        for (const item of props.formItems) {
            if (!userInputForm.value[item.name]
                || (typeof userInputForm.value[item.name] === 'string' && !userInputForm.value[item.name].trim())) {
                Dialog.tipError(t(`form.inputField`, {title: item.label}));
                return;
            }
            replaceParam[item.name] = userInputForm.value[item.name];
        }
    } else {
        if (!userInput.value.trim()) {
            Dialog.tipError(t("hint.inputContent"));
            return;
        }
        replaceParam['content'] = userInput.value;
    }
    for (const k of Object.keys(replaceParam)) {
        const v = replaceParam[k];
        const reg = new RegExp(`{\\s*${k}\\s*}`, 'g');
        prompt = prompt.replace(reg, v);
    }
    // console.log('生成提示词:', JSON.stringify({prompt, replaceParam}, null, 2));

    loading.value = true;
    buttonLoading.value = true;
    try {
        const ret = await modelGenerator.value.chat(prompt, {
            systemPrompt: props.systemPrompt,
        });
        if (ret.code) {
            Dialog.tipError(ret.msg);
            return;
        }
        emit('result', ret.data?.content!);
        visible.value = false;
        userInput.value = '';
    } catch (e) {
        console.error(e);
        Dialog.tipError(t("common.generateFailed") + ":" + e);
    } finally {
        loading.value = false;
        buttonLoading.value = false;
    }
};
</script>

<template>
    <ModelGenerator ref="modelGenerator" :biz="biz"/>
    <a-button class="mr-1" @click="showDialog" :loading="buttonLoading">
        <template #icon>
            <icon-robot/>
        </template>
        {{ title }}
    </a-button>
    <a-modal v-model:visible="visible"
             title-align="start"
             :title="title">
        <template #footer>
            <a-button @click="visible = false" :disabled="loading">{{ $t("common.cancel") }}</a-button>
            <a-button type="primary" @click="doGenerate" :loading="loading">{{ $t("common.generate") }}</a-button>
        </template>
        <div>
            <div v-if="formItems.length>0">
                <a-form layout="vertical" :model="{}">
                    <a-form-item v-for="item in formItems" :key="item.name" :label="item.label">
                        <a-input v-if="item.type==='text'"
                                 v-model="userInputForm[item.name]"
                                 :placeholder="item.label"/>
                        <a-input-number v-else-if="item.type==='number'"
                                        v-model="userInputForm[item.name]"
                                        :placeholder="item.label" class="w-full"/>
                        <a-textarea v-else-if="item.type==='textarea'"
                                    v-model="userInputForm[item.name]"
                                    :placeholder="item.label"
                                    :auto-size="{minRows:2,maxRows:6}"/>
                    </a-form-item>
                </a-form>
            </div>
            <div v-else>
                <a-textarea v-model="userInput" :placeholder="placeholder" :auto-size="{minRows:2,maxRows:6}"/>
            </div>
        </div>
    </a-modal>
</template>

<style scoped>

</style>
