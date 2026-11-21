<script setup lang="ts">
import { t } from "../../../../lang";
const props = defineProps<{
    data: {
        normalizationPercentage?: number;
    };
}>();
</script>

<template>
    <div class="flex flex-wrap mb-2 gap-1">
        <a-tag class="rounded-lg">{{
            data.normalizationPercentage !== undefined
                ? t("app.normalizationLevelValue", {
                      value: data.normalizationPercentage,
                  })
                : t("common.notConfigured")
        }}</a-tag>
    </div>
</template>
