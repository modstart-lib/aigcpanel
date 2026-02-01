<script setup lang="ts">
import {ref} from "vue";
import {Dialog} from "../../lib/dialog";
import {t} from "../../lang";
import {doCopy} from "../../components/common/util";

const props = defineProps<{
    size?: "small" | undefined,
    title: string;
    name: string;
    defaultPrompt: string;
    defaultSystemPrompt?: string;
    promptPlaceholder?: string;
    systemPromptPlaceholder?: string;
    enableSystemPrompt?: boolean;
    help?: string;
    param?: Record<string, string> | { name: string, label: string }[];
}>();
const visible = ref(false);
const prompt = ref<string>("");
const systemPrompt = ref<string>("");
const doShow = async () => {
    visible.value = true;
    prompt.value = (await $mapi.storage.get("data", props.name, props.defaultPrompt)) as string;
    if (props.enableSystemPrompt) {
        systemPrompt.value = (await $mapi.storage.get("data", props.name + "System", props.defaultSystemPrompt)) as string;
    }
};
const doSave = () => {
    visible.value = false;
    $mapi.storage.set("data", props.name, prompt.value);
    if (props.enableSystemPrompt) {
        $mapi.storage.set("data", props.name + "System", systemPrompt.value);
    }
    Dialog.tipSuccess(t('common.saveSuccess'));
};
const doRestore = () => {
    prompt.value = props.defaultPrompt;
    $mapi.storage.set("data", props.name, prompt.value);
    if (props.enableSystemPrompt) {
        systemPrompt.value = props.defaultSystemPrompt || '';
        $mapi.storage.set("data", props.name + "System", systemPrompt.value);
    }
};
</script>

<template>
    <a-button @click="doShow()" :size="size">
        <template #icon>
            <icon-file/>
        </template>
        {{ title }}
    </a-button>
    <a-modal v-model:visible="visible" width="800px" title-align="start">
        <template #title>
            {{ title }}
        </template>
        <template #footer>
            <a-button @click="doRestore">
                {{ $t("common.restoreDefault") }}
            </a-button>
            <a-button type="primary" @click="doSave">
                {{ $t("common.save") }}
            </a-button>
        </template>
        <div class="-mx- -my-3" style="height:60vh">
            <slot></slot>
            <div v-if="help">
                <a-alert type="info" show-icon class="mb-2">
                    {{ help }}
                </a-alert>
            </div>
            <div v-if="enableSystemPrompt">
                <div class="text-sm mb-1">系统提示词</div>
                <div>
                    <a-textarea v-model="systemPrompt as any"
                                :placeholder="systemPromptPlaceholder"
                                :auto-size="{minRows: 10, maxRows: 15}"/>
                </div>
            </div>
            <div>
                <div v-if="enableSystemPrompt" class="text-sm mb-1">
                    用户提示词
                </div>
                <div>
                    <a-textarea v-model="prompt as any"
                                :placeholder="promptPlaceholder"
                                :auto-size="{minRows: 10, maxRows: 15}"/>
                </div>
            </div>
            <div v-if="props.param">
                <div class="mt-2 font-bold">{{ $t("common.availableVars") }}:</div>
                <div class="mt-1" v-if="Array.isArray(props.param)">
                    <div v-for="item in props.param as any" :key="item.name"
                         class="mr-4 inline-flex items-center text-xs">
                        <div class="font-mono mr-1 cursor-pointer"
                             @click="doCopy(`{${item.name}}`)">
                            {{ "{" + item.name + "}" }}
                        </div>
                        <div class="text-gray-400">
                            {{ item.label }}
                        </div>
                    </div>
                </div>
                <div class="mt-1" v-else>
                    <div v-for="(value, key) in props.param" :key="key"
                         class="mr-4 inline-flex items-center text-xs">
                        <div class="font-mono mr-1 cursor-pointer"
                             @click="doCopy(`{${key}}`)">
                            {{ "{" + key + "}" }}
                        </div>
                        <div class="text-gray-400">
                            {{ value }}
                        </div>
                    </div>
                </div>
            </div>
            <div class="h-4"></div>
        </div>
    </a-modal>
</template>
