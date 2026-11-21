<script setup lang="ts">
import { t } from "../../../../lang";
const props = defineProps<{
    data: {
        transitionEffect?: string;
        transitionDuration?: number;
    };
}>();

const transitionTextMap: Record<string, string> = {
    none: "app.transitionNone",
    fade: "app.transitionFade",
    wipeleft: "app.transitionWipeLeft",
    wiperight: "app.transitionWipeRight",
    slideleft: "app.transitionSlideLeft",
    slideright: "app.transitionSlideRight",
    dissolve: "app.transitionDissolve",
};

const getTransitionEffectText = (effect?: string) => {
    if (!effect) return t("common.notConfigured");
    return t(transitionTextMap[effect] || effect) || effect;
};
</script>

<template>
    <div class="flex flex-wrap mb-2 gap-1">
        <a-tag class="rounded-lg"
            >{{ t("app.transitionEffect") }}
            {{ getTransitionEffectText(data.transitionEffect) }}</a-tag
        >
        <a-tag
            v-if="data.transitionEffect && data.transitionEffect !== 'none'"
            class="rounded-lg"
            >{{ t("app.transitionDuration") }}
            {{
                data.transitionDuration
                    ? `${data.transitionDuration}ms`
                    : t("common.notConfigured")
            }}
        </a-tag>
    </div>
</template>
