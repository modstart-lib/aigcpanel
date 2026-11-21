<script setup lang="ts">
import { t } from "../../lang";
import { doOpenFile } from "./util";
import { computed, watch } from "vue";
import { FileUtil } from "../../lib/file";
import { Dialog } from "../../lib/dialog";
import { useTruncated } from "./useTruncated";

const props = defineProps<{
    modelValue: string;
    extensions: string[];
}>();
const emit = defineEmits<{
    "update:modelValue": [string];
}>();
const doSelectFile = async () => {
    const result = await doOpenFile({ extensions: props.extensions });
    if (!result) {
        return;
    }
    const ext = FileUtil.getExt((result || "") as string);
    if (!props.extensions.includes(ext)) {
        Dialog.tipError(
            t("hint.selectFileFormat", {
                extensions: props.extensions.join(","),
            }),
        );
        return;
    }
    emit("update:modelValue", result as string);
};
const name = computed(() => {
    return FileUtil.getBaseName(props.modelValue, true);
});

// Full button text; ellipsized in narrow cards, full text on hover when cut
const buttonText = computed(() => {
    const label = props.modelValue
        ? t("common.reselect")
        : t("common.selectFile");
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
    <template v-if="modelValue">
        <a-tooltip :content="modelValue" mini>
            <div
                class="flex items-center gap-1 flex-grow text-sm text-black rounded-lg leading-7 px-3 min-h-7 border border-gray-500 cursor-default select-none overflow-hidden"
            >
                <icon-file class="flex-shrink-0" />
                <span class="truncate min-w-0">{{ name }}</span>
            </div>
        </a-tooltip>
        <a-button @click="doSelectFile">
            <icon-file />
            {{ t("common.reselect") }}
        </a-button>
    </template>
    <a-tooltip v-else :content="buttonText" :disabled="!truncated" mini>
        <a-button @click="doSelectFile" class="max-w-full overflow-hidden">
            <span
                class="inline-flex items-center gap-1 min-w-0 max-w-full text-left"
            >
                <icon-file class="flex-shrink-0" />
                <span ref="textEl" class="truncate">{{ buttonText }}</span>
            </span>
        </a-button>
    </a-tooltip>
</template>
