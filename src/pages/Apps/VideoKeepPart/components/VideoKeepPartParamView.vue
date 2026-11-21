<script setup lang="ts">
const props = defineProps<{
    data: {
        action?: "keep" | "remove";
    };
}>();
</script>

<template>
    <div class="flex flex-wrap items-center gap-1 mb-2">
        <a-tag class="rounded-lg">{{
            data.action
                ? data.action === "keep"
                    ? $t("app.keepSelectedSegments")
                    : $t("app.removeSelectedSegments")
                : $t("common.notConfigured")
        }}</a-tag>
    </div>
</template>
