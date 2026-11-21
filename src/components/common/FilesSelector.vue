<script setup lang="ts">
import { computed, watch } from "vue";
import { t } from "../../lang";
import { Dialog } from "../../lib/dialog";
import { FileUtil } from "../../lib/file";
import { doOpenFile } from "./util";
import { useTruncated } from "./useTruncated";

const props = defineProps<{
    modelValue: string[];
    extensions: string[];
}>();
const emit = defineEmits<{
    "update:modelValue": [string[]];
}>();

const doSelectFile = async () => {
    const result = await doOpenFile({
        extensions: props.extensions,
        multiple: true,
    });
    if (!result) {
        return;
    }
    const files = Array.isArray(result) ? result : [result];
    const validFiles: string[] = [];
    for (const file of files) {
        const ext = FileUtil.getExt(file);
        if (!props.extensions.includes(ext)) {
            Dialog.tipError(
                t("hint.selectFileFormat", {
                    extensions: props.extensions.join(","),
                }),
            );
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
    return props.modelValue.map((path) => FileUtil.getBaseName(path, true));
});

// Full button text; ellipsized in narrow cards, full text on hover when cut
const buttonText = computed(() => {
    const label = t("common.addFile");
    if (!props.extensions.length) {
        return label;
    }
    return `${label} (${t("common.extensions", {
        extensions: props.extensions.join(", "),
    })})`;
});
const { textEl, truncated, check } = useTruncated();
watch(buttonText, () => {
    check();
});
</script>

<template>
    <div class="flex flex-col gap-2">
        <div v-if="modelValue.length > 0" class="flex flex-col gap-1">
            <div
                v-for="(name, index) in names"
                :key="index"
                class="flex items-center gap-2 text-sm text-black rounded-lg leading-7 px-3 min-h-7 border border-gray-500 overflow-hidden"
            >
                <icon-file class="flex-shrink-0" />
                <a-tooltip :content="modelValue[index]" mini>
                    <span class="flex-grow truncate min-w-0">{{ name }}</span>
                </a-tooltip>
                <a-button size="mini" @click="removeFile(index)">
                    <icon-close />
                </a-button>
            </div>
        </div>
        <a-tooltip :content="buttonText" :disabled="!truncated" mini>
            <a-button @click="doSelectFile" class="max-w-full overflow-hidden">
                <span
                    class="inline-flex items-center gap-1 min-w-0 max-w-full text-left"
                >
                    <icon-plus class="flex-shrink-0" />
                    <span ref="textEl" class="truncate">
                        {{ buttonText }}
                    </span>
                </span>
            </a-button>
        </a-tooltip>
    </div>
</template>
