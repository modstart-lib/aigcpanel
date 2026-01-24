<script setup lang="ts">
import {nextTick, onMounted, ref} from "vue";
import {EditorView, keymap, lineNumbers} from "@codemirror/view";
import {dracula} from "@uiw/codemirror-theme-dracula";
import {quietlight} from "@uiw/codemirror-theme-quietlight";
import {python} from "@codemirror/lang-python";
import {defaultKeymap} from "@codemirror/commands";
import {EditorState} from "@codemirror/state";

const visible = ref(false);
const codeEditorDom = ref<HTMLElement>();
let editor = null as EditorView | null;
const useDark = false;

const show = (code: string) => {
    visible.value = true;
    nextTick(() => {
        initEditor();
        setEditorContent(code);
    });
};

const initEditor = () => {
    if (editor) {
        return;
    }
    editor = new EditorView({
        extensions: [
            useDark ? dracula : quietlight,
            python(),
            keymap.of(defaultKeymap),
            lineNumbers(),
            EditorState.readOnly.of(true),
        ],
        parent: codeEditorDom.value,
    });
};

const setEditorContent = (code: string) => {
    if (!editor) {
        setTimeout(() => {
            setEditorContent(code);
        }, 100);
        return;
    }
    const transaction = editor.state.update({
        changes: {from: 0, to: editor.state.doc.length, insert: code},
    });
    editor.dispatch(transaction);
};

onMounted(() => {});

defineExpose({
    show,
});
</script>

<template>
    <a-modal v-model:visible="visible" :footer="false" width="80vw">
        <template #title>
            {{ $t("common.viewCode") }}
        </template>
        <div>
            <div class="w-full h-96">
                <div ref="codeEditorDom" class=""></div>
            </div>
        </div>
    </a-modal>
</template>

<style lang="less">
.cm-editor {
    height: 100%;
    font-size: 1.2rem;
}
</style>
