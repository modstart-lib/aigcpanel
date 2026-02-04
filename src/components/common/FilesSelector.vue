<script setup lang="ts">
import {computed} from "vue";
import {t} from "../../lang";
import {Dialog} from "../../lib/dialog";
import {FileUtil} from "../../lib/file";
import {doOpenFile} from "./util";

const props = defineProps<{
    modelValue: string[];
    extensions: string[],
}>();
const emit = defineEmits<{
    "update:modelValue": [string[]];
}>();

const doSelectFile = async () => {
    const result = await doOpenFile({extensions: props.extensions, multiple: true});
    if (!result) {
        return;
    }
    const files = Array.isArray(result) ? result : [result];
    const validFiles: string[] = [];
    for (const file of files) {
        const ext = FileUtil.getExt(file);
        if (!props.extensions.includes(ext)) {
            Dialog.tipError(t("hint.selectFileFormat", {extensions: props.extensions.join(',')}));
            return;
        }
        validFiles.push(file);
    }
    emit("update:modelValue", [...props.modelValue, ...validFiles]);
};

const removeFile = (index: number) => {
    const newValue = [...props.modelValue];
    newValue.splice(index, 1);
    emit("update:modelValue", newValue);
};

const names = computed(() => {
    return props.modelValue.map(path => FileUtil.getBaseName(path, true));
});
</script>

<template>
    <div class="flex flex-col gap-2">
        <div v-if="modelValue.length > 0" class="flex flex-col gap-1">
            <div v-for="(name, index) in names" :key="index" class="flex items-center gap-2 text-sm text-black rounded-lg leading-7 px-3 min-h-7 border border-gray-500">
                <icon-file/>
                <a-tooltip :content="modelValue[index]" mini>
                    <span class="flex-grow">{{ name }}</span>
                </a-tooltip>
                <a-button size="mini" @click="removeFile(index)">
                    <icon-close/>
                </a-button>
            </div>
        </div>
        <a-button @click="doSelectFile">
            <icon-plus/>
            {{ t("common.addFile") }}
            ({{ t("common.extensions", {extensions: extensions.join(', ')}) }})
        </a-button>
    </div>
</template>
