<script setup lang="ts">
import {computed, ref} from "vue";
import {doCopy} from "./util";
import {Dialog} from "../../lib/dialog";
import {t} from "../../lang";

const props = defineProps<{
    size?: "small" | undefined,
    title: string;
    name: string;
    defaultValue: string | { key: string, value: string }[];
    placeholder?: string;
    help?: string;
    param?: Record<string, string> | { name: string, label: string }[];
}>();
const visible = ref(false);
const content = ref<string | { key: string, value: string }[]>("");
const doShow = async () => {
    visible.value = true;
    content.value = (await $mapi.storage.get("data", props.name, props.defaultValue)) as string;
};
const doSave = () => {
    visible.value = false;
    $mapi.storage.set("data", props.name, content.value);
    Dialog.tipSuccess(t('common.saveSuccess'));
};
const doRestore = () => {
    content.value = props.defaultValue;
    $mapi.storage.set("data", props.name, content.value);
};
const type = computed(() => {
    if (Array.isArray(props.defaultValue)) {
        return "keyValueList";
    }
    return "text";
});
</script>

<template>
    <a-button @click="doShow()" :size="size">
        <template #icon>
            <icon-unordered-list v-if="type==='keyValueList'"/>
            <icon-file v-else/>
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
        <div class="-mx-2 -my-3" style="height:60vh">
            <slot></slot>
            <div v-if="help">
                <a-alert type="info" show-icon class="mb-2">
                    {{ help }}
                </a-alert>
            </div>
            <div v-if="type==='keyValueList'">
                <div v-for="(item, index) in content as any" :key="index" class="mb-2 flex items-center">
                    <a-input v-model="item.key" :placeholder="$t('common.key')" class="mr-2"/>
                    <a-input v-model="item.value" :placeholder="$t('common.value')" class="mr-2"/>
                    <a-button type="text" danger @click="(content as any).splice(index, 1)">
                        <icon-delete/>
                    </a-button>
                </div>
                <div>
                    <a-button type="dashed" block @click="(content as any).push({key: '', value: ''})">
                        <template #icon>
                            <icon-plus/>
                        </template>
                        {{ $t("common.add") }}
                    </a-button>
                </div>
            </div>
            <div v-else>
                <a-textarea v-model="content as any" :placeholder="placeholder"
                            :auto-size="{minRows: 15, maxRows: 15}"/>
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
