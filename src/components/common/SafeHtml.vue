<script setup lang="ts">
import { computed } from "vue";
import { sanitizeHtml, type HtmlProfile } from "../../lib/sanitize";
import { doCopy } from "./util";

const props = withDefaults(
    defineProps<{
        html?: string | null;
        profile?: HtmlProfile;
    }>(),
    {
        html: "",
        profile: "basic",
    },
);

const safe = computed(() => sanitizeHtml(props.html, props.profile));

// A sanitized link must open in the system browser, never in this window:
// the renderer runs with Node integration, so navigation equals code execution.
const onClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    // Keep the click-to-copy behaviour for inline code snippets.
    const code = target?.closest?.("code");
    if (code) {
        doCopy(code.textContent || "");
        return;
    }
    const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!anchor) {
        return;
    }
    e.preventDefault();
    const href = anchor.getAttribute("href") || "";
    if (/^https?:\/\//i.test(href)) {
        $mapi.app.openExternal(href);
    }
};
</script>

<template>
    <!-- eslint-disable-next-line vue/no-v-html -- sanitized above -->
    <div class="pb-safe-html" @click="onClick" v-html="safe"></div>
</template>

<style lang="less" scoped>
.pb-safe-html {
    :deep(code) {
        background: rgba(0, 0, 0, 0.05);
        border-radius: 0.2rem;
        display: inline-block;
        padding: 0.1rem 0.2rem;
        margin-bottom: 0.2rem;
    }
    :deep(pre) {
        overflow-x: auto;
    }
    :deep(a) {
        color: #2563eb;
        text-decoration: underline;
        cursor: pointer;
    }
    :deep(img) {
        max-width: 100%;
    }
}
</style>
