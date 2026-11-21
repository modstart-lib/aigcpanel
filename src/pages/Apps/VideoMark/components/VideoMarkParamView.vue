<script setup lang="ts">
const props = defineProps<{
    data: {
        borderColor?: string;
        borderWidth?: number;
        borderOpacity?: number;
        borderRadius?: number;
        borderStyle?: "solid" | "dashed";
    };
}>();
</script>

<template>
    <div class="flex flex-wrap items-center gap-1 mb-2">
        <a-tag class="rounded-lg"
            >{{ $t("app.borderColor") }}
            {{ data.borderColor || $t("common.notConfigured") }}</a-tag
        >
        <a-tag class="rounded-lg"
            >{{ $t("app.borderWidth") }}
            {{ data.borderWidth || $t("common.notConfigured") }}</a-tag
        >
        <a-tag class="rounded-lg"
            >{{ $t("app.borderOpacity") }}
            {{
                data.borderOpacity
                    ? data.borderOpacity * 100 + "%"
                    : $t("common.notConfigured")
            }}</a-tag
        >
        <a-tag class="rounded-lg"
            >{{ $t("app.borderRadius") }}
            {{ data.borderRadius || $t("common.notConfigured") }}</a-tag
        >
        <a-tag class="rounded-lg"
            >{{ $t("app.borderStyle") }}
            {{
                data.borderStyle === "solid"
                    ? $t("app.borderSolid")
                    : data.borderStyle === "dashed"
                      ? $t("app.borderDashed")
                      : $t("common.notConfigured")
            }}</a-tag
        >
    </div>
</template>
