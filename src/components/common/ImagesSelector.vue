<script setup lang="ts">
import { t } from "../../lang";
import { doOpenFile } from "./util";
import ImagePreviewBox from "./ImagePreviewBox.vue";
import { FileUtil } from "../../lib/file";
import { Dialog } from "../../lib/dialog";

/**
 * 多图选择组件
 * 支持多选上传、缩略图预览、逐张删除
 */
const props = withDefaults(
    defineProps<{
        modelValue: string[];
        extensions?: string[];
        width?: string;
        height?: string;
    }>(),
    {
        extensions: () => ["png", "jpg", "jpeg"],
        width: "8rem",
        height: "8rem",
    },
);
const emit = defineEmits<{
    "update:modelValue": [string[]];
}>();

const doAddImages = async () => {
    const result = await doOpenFile({
        extensions: props.extensions,
        multiple: true,
    });
    if (!result) {
        return;
    }
    const files = Array.isArray(result) ? result : [result];
    const images = [...props.modelValue];
    for (const f of files) {
        const file = f as string;
        const ext = FileUtil.getExt(file || "");
        if (!props.extensions.includes(ext)) {
            Dialog.tipError(
                t("hint.selectFileFormat", {
                    extensions: props.extensions.join(","),
                }),
            );
            continue;
        }
        if (!images.includes(file)) {
            images.push(file);
        }
    }
    emit("update:modelValue", images);
};

const doRemoveImage = (index: number) => {
    const images = [...props.modelValue];
    images.splice(index, 1);
    emit("update:modelValue", images);
};
</script>

<template>
    <div>
        <div class="flex items-center gap-2">
            <a-button @click="doAddImages">
                <template #icon><icon-plus /></template>
                {{ $t("common.selectFile") }}
            </a-button>
            <span v-if="modelValue.length" class="text-sm text-gray-500">
                {{ modelValue.length }} 张图片
            </span>
        </div>
        <div v-if="modelValue.length" class="mt-2 flex flex-wrap gap-2">
            <div
                v-for="(image, idx) in modelValue"
                :key="image + idx"
                class="relative"
            >
                <ImagePreviewBox :url="image" :width="width" :height="height" />
                <a-button
                    class="absolute -top-2 -right-2"
                    size="mini"
                    shape="circle"
                    @click="doRemoveImage(idx)"
                >
                    <template #icon><icon-close /></template>
                </a-button>
            </div>
        </div>
    </div>
</template>
