<script setup lang="ts">
import {onBeforeUnmount, onMounted, ref} from "vue";
import {UI} from "../../lib/ui";

type DragPasteFile = {
    name: string;
    isDirectory: boolean;
    isFile: boolean;
    path: string;
    fileExt: string;
};

const dragPasteContainer = ref<HTMLElement | null>(null);
const props = defineProps({
    pasteEnable: {
        type: Boolean,
        default: true,
    },
    dragEnable: {
        type: Boolean,
        default: true,
    },
});
const emit = defineEmits({
    input: (files: DragPasteFile[]) => true,
});
onMounted(() => {
    if (props.pasteEnable) {
        window.addEventListener("paste", onPaste);
    }
    if (props.dragEnable) {
        dragPasteContainer.value?.addEventListener("dragenter", onDragEnter);
        dragPasteContainer.value?.addEventListener("dragstart", onDragStart);
        dragPasteContainer.value?.addEventListener("dragend", onDragEnd);
        dragPasteContainer.value?.addEventListener("dragover", onDragOver);
        dragPasteContainer.value?.addEventListener("dragleave", onDragLeave);
        dragPasteContainer.value?.addEventListener("drop", onDrop);
        UI.onResize(dragPasteContainer.value, (width, height) => {
            const rect = dragPasteContainer.value?.getBoundingClientRect();
            if (rect) {
                dragMaskStyle.value = {
                    left: `${rect.left}px`,
                    top: `${rect.top}px`,
                    width: `${rect.width}px`,
                    height: `${rect.height}px`,
                };
            }
            // console.log('resize', width, height, dragPasteContainer.value?.getBoundingClientRect())
        });
    }
});
onBeforeUnmount(() => {
    if (props.pasteEnable) {
        window.removeEventListener("paste", onPaste);
    }
    if (props.dragEnable) {
        dragPasteContainer.value?.removeEventListener("dragenter", onDragEnter);
        dragPasteContainer.value?.removeEventListener("dragstart", onDragStart);
        dragPasteContainer.value?.removeEventListener("dragend", onDragEnd);
        dragPasteContainer.value?.removeEventListener("dragover", onDragOver);
        dragPasteContainer.value?.removeEventListener("dragleave", onDragLeave);
        dragPasteContainer.value?.removeEventListener("drop", onDrop);
        UI.offResize(dragPasteContainer.value);
    }
});

const dragIsOver = ref(false);
const dragMaskStyle = ref({
    left: "0",
    top: "0",
    width: "100%",
    height: "100%",
});

const onPaste = async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items || [];
    const files: any[] = [];
    for (let i = 0; i < items.length; i++) {
        if (items[i].kind === "file") {
            const file = items[i].getAsFile();
            if (file) {
                files.push(file);
            }
        }
    }
    onInput(files).then();
};

const onDrop = (e: DragEvent) => {
    dragIsOver.value = false;
    // console.log('onDrop')
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer?.files || [];
    if (files.length > 0) {
        onInput(Array.from(files)).then();
    }
};

const onInput = async (files: any[]) => {
    dragIsOver.value = false;
    const results: DragPasteFile[] = [];
    for (const f of files) {
        const isDirectory = await window.$mapi.file.isDirectory(f.path, {
            isDataPath: false,
        });
        const pcs = f.name.split(".");
        let fileExt = "";
        if (pcs.length > 1) {
            fileExt = (pcs.pop() || "").toLowerCase();
        }
        results.push({
            name: f.name,
            isDirectory: isDirectory,
            isFile: !isDirectory,
            path: f.path,
            fileExt,
        });
    }
    emit("input", results);
};

const onDragEnter = (e: DragEvent) => {
    // console.log('onDragEnter')
    e.preventDefault();
    e.stopPropagation();
    dragIsOver.value = true;
};

const onDragStart = (e: DragEvent) => {
    // console.log('onDragStart')
    e.preventDefault();
    e.stopPropagation();
    dragIsOver.value = true;
};

const onDragEnd = (e: DragEvent) => {
    // console.log('onDragEnd')
    e.preventDefault();
    e.stopPropagation();
    dragIsOver.value = false;
};

const onDragOver = (e: DragEvent) => {
    // console.log('onDragOver')
    e.preventDefault();
    e.stopPropagation();
    dragIsOver.value = true;
};

const onDragLeave = (e: DragEvent) => {
    // console.log('onDragLeave')
    e.preventDefault();
    e.stopPropagation();
    dragIsOver.value = false;
};
</script>

<template>
    <div ref="dragPasteContainer" class="relative">
        <slot></slot>
        <div
            class="fixed bg-white bg-opacity-80 flex debug pointer-events-none"
            v-if="dragIsOver"
            :style="dragMaskStyle"
        >
            <div class="m-auto text-center text-gray-400">
                <div>
                    <icon-file class="text-5xl" />
                </div>
                <div>
                    <icon-drag-arrow />
                    {{ $t("common.dragHereToRelease") }}
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped></style>
