import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";

/**
 * Detect whether a text element is showing an ellipsis (content wider than
 * its box), so callers can show a tooltip with the full text on hover.
 */
export function useTruncated() {
    const textEl = ref<HTMLElement | null>(null);
    const truncated = ref(false);

    const check = async () => {
        await nextTick();
        const el = textEl.value;
        if (!el) {
            truncated.value = false;
            return;
        }
        truncated.value = el.scrollWidth > el.clientWidth + 1;
    };

    let observer: ResizeObserver | undefined;

    const bindObserver = async () => {
        await nextTick();
        if (!textEl.value || typeof ResizeObserver === "undefined") {
            return;
        }
        observer?.disconnect();
        observer = new ResizeObserver(() => {
            check();
        });
        observer.observe(textEl.value);
    };

    onMounted(() => {
        check();
        bindObserver();
        window.addEventListener("resize", check);
    });

    onBeforeUnmount(() => {
        window.removeEventListener("resize", check);
        observer?.disconnect();
    });

    return { textEl, truncated, check };
}
