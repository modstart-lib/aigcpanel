<script setup lang="ts">
import { computed, ref, onMounted, nextTick } from "vue";
import { marked } from "marked";

const props = defineProps<{
    content: string;
}>();

const contentRef = ref<HTMLElement | null>(null);
const activeNav = ref("");

interface NavItem {
    id: string;
    title: string;
}

// Parse headings from markdown for navigation
const slugify = (text: string) =>
    String(text)
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fff]+/g, "-")
        .replace(/^-+|-+$/g, "");

const escapeHtml = (text: string) =>
    String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

const navItems = computed<NavItem[]>(() => {
    const items: NavItem[] = [];
    const regex = /^##\s+(.+)$/gm;
    let match;
    while ((match = regex.exec(props.content)) !== null) {
        const title = match[1].trim();
        const id = slugify(title);
        items.push({ id, title });
    }
    return items;
});

// Render markdown to HTML with heading IDs
// NOTE: marked >= 13 passes a single token object to renderer callbacks,
// older versions pass positional args. Handle both shapes.
const renderedHtml = computed(() => {
    const renderer = new marked.Renderer();
    renderer.heading = function (token: any, level?: number) {
        const isToken = token && typeof token === "object";
        const text = isToken ? (token.text ?? "") : String(token ?? "");
        const depth = isToken ? (token.depth ?? 2) : (level ?? 2);
        const inner =
            isToken && (this as any).parser && token.tokens
                ? (this as any).parser.parseInline(token.tokens)
                : text;
        return `<h${depth} id="${slugify(text)}">${inner}</h${depth}>`;
    };
    renderer.code = function (token: any, language?: string) {
        const isToken = token && typeof token === "object";
        const code = isToken ? (token.text ?? "") : String(token ?? "");
        const lang = isToken ? (token.lang ?? "") : (language ?? "");
        const escaped = isToken ? token.escaped : false;
        const body = escaped ? code : escapeHtml(code);
        return `<pre><code class="language-${lang}">${body}</code></pre>`;
    };

    const html = marked(props.content, {
        renderer,
        breaks: true,
        gfm: true,
    }) as string;

    // Add styling to tables
    const styledHtml = html
        .replace(/<table>/g, '<table class="doc-table">')
        .replace(/<pre>/g, '<pre class="doc-pre">')
        .replace(/<code>/g, '<code class="doc-code">');

    return styledHtml;
});

function scrollTo(id: string) {
    activeNav.value = id;
    const el = contentRef.value?.querySelector(`#${CSS.escape(id)}`);
    if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
}

function onContentScroll() {
    if (!contentRef.value) return;
    const container = contentRef.value;
    const headings = container.querySelectorAll("h2");
    let currentId = "";
    for (const h of headings) {
        const rect = h.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        if (rect.top - containerRect.top <= 80) {
            currentId = h.id;
        }
    }
    if (currentId && currentId !== activeNav.value) {
        activeNav.value = currentId;
    }
}

onMounted(() => {
    // Set first nav as active
    if (navItems.value.length > 0) {
        activeNav.value = navItems.value[0].id;
    }
});
</script>

<template>
    <div class="doc-container">
        <!-- Left navigation -->
        <div class="doc-nav" v-if="navItems.length > 0">
            <div class="doc-nav-title">目录</div>
            <div
                v-for="item in navItems"
                :key="item.id"
                class="doc-nav-item"
                :class="{ active: activeNav === item.id }"
                @click="scrollTo(item.id)"
            >
                {{ item.title }}
            </div>
        </div>
        <!-- Right content -->
        <div
            ref="contentRef"
            class="doc-content"
            @scroll="onContentScroll"
            v-html="renderedHtml"
        ></div>
    </div>
</template>

<style scoped>
.doc-container {
    display: flex;
    gap: 0;
    height: 100%;
    overflow: hidden;
}

.doc-nav {
    width: 170px;
    flex-shrink: 0;
    border-right: 1px solid var(--color-border, #e5e8ef);
    padding: 12px 0;
    overflow-y: auto;
    overflow-x: hidden;
}

.doc-nav-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text-secondary, #86909c);
    padding: 4px 16px 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.doc-nav-item {
    font-size: 13px;
    padding: 6px 16px;
    cursor: pointer;
    color: var(--color-text, #4e5969);
    border-left: 3px solid transparent;
    transition: all 0.15s;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.doc-nav-item:hover {
    background: var(--color-bg-hover, #f7f8fa);
    color: var(--color-text-primary, #1d2129);
}

.doc-nav-item.active {
    color: var(--color-primary, #165dff);
    border-left-color: var(--color-primary, #165dff);
    background: var(--color-bg-active, #e8f4ff);
    font-weight: 500;
}

.doc-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px 24px;
    font-size: 14px;
    line-height: 1.8;
    color: var(--color-text, #1d2129);
}

.doc-content :deep(h2) {
    font-size: 18px;
    font-weight: 600;
    margin: 24px 0 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--color-border, #e5e8ef);
    scroll-margin-top: 16px;
}

.doc-content :deep(h3) {
    font-size: 15px;
    font-weight: 600;
    margin: 20px 0 8px;
}

.doc-content :deep(h4) {
    font-size: 14px;
    font-weight: 600;
    margin: 16px 0 6px;
}

.doc-content :deep(p) {
    margin: 8px 0;
}

.doc-content :deep(ul),
.doc-content :deep(ol) {
    padding-left: 20px;
    margin: 8px 0;
}

.doc-content :deep(li) {
    margin: 4px 0;
}

.doc-content :deep(strong) {
    font-weight: 600;
}

.doc-content :deep(table.doc-table) {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-size: 13px;
}

.doc-content :deep(table.doc-table th) {
    text-align: left;
    padding: 8px 12px;
    background: var(--color-bg-secondary, #f7f8fa);
    color: var(--color-text-secondary, #86909c);
    font-weight: 500;
    border-bottom: 1px solid var(--color-border, #e5e8ef);
}

.doc-content :deep(table.doc-table td) {
    padding: 8px 12px;
    border-bottom: 1px solid var(--color-border-secondary, #f0f1f5);
    color: var(--color-text, #4e5969);
    vertical-align: top;
}

.doc-content :deep(table.doc-table td:first-child) {
    font-family: monospace;
    color: var(--color-primary, #165dff);
    white-space: nowrap;
}

.doc-content :deep(tr:last-child td) {
    border-bottom: none;
}

.doc-content :deep(pre.doc-pre) {
    background: var(--color-bg-code, #f7f8fa);
    border-radius: 6px;
    padding: 14px 16px;
    font-size: 12px;
    overflow-x: auto;
    line-height: 1.7;
    border: 1px solid var(--color-border, #e5e8ef);
    margin: 12px 0;
}

.doc-content :deep(code.doc-code) {
    background: var(--color-bg-code, #f7f8fa);
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 12px;
    font-family: monospace;
}

.doc-content :deep(pre.doc-pre code.doc-code) {
    background: none;
    padding: 0;
    border-radius: 0;
}

.doc-content :deep(blockquote) {
    border-left: 3px solid var(--color-primary, #165dff);
    padding: 8px 16px;
    margin: 12px 0;
    background: var(--color-bg-secondary, #f7f8fa);
    border-radius: 0 4px 4px 0;
}

.doc-content :deep(hr) {
    border: none;
    border-top: 1px solid var(--color-border, #e5e8ef);
    margin: 24px 0;
}
</style>
