<script setup lang="ts">
import {t} from "../../lang";
import {doOpenFile} from "./util";
import {computed} from "vue";
import {FileUtil} from "../../lib/file";
import {Dialog} from "../../lib/dialog";

const props = defineProps<{
    modelValue: string;
    extensions: string[],
}>();
const emit = defineEmits<{
    "update:modelValue": [string];
}>();
const doSelectFile = async () => {
    const result = await doOpenFile({extensions: props.extensions})
    if (!result) {
        return;
    }
    const ext = FileUtil.getExt((result || '') as string);
    if (!props.extensions.includes(ext)) {
        Dialog.tipError(t("hint.selectFileFormat", {extensions: props.extensions.join(',')}));
        return;
    }
    emit("update:modelValue", result as string);
};
const name = computed(() => {
    return FileUtil.getBaseName(props.modelValue, true);
})
</script>

<template>
    <a-tooltip v-if="modelValue" :content="modelValue" mini>
        <div
            class="flex-grow text-sm text-black rounded-lg leading-7 px-3 min-h-7 border border-gray-500 cursor-default select-none">
            <icon-file/>
            {{ name }}
        </div>
    </a-tooltip>
    <a-button @click="doSelectFile" :class="modelValue?'':'w-64'">
        <icon-file/>
        {{ modelValue ? t("common.reselect") : t("common.selectFile") }}
        ({{ t("common.extensions", {extensions: extensions.join(', ')}) }})
    </a-button>
</template>

