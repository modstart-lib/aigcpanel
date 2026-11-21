<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { getNavTab, rememberNavTab } from "../lib/nav-memory";
import { t } from "../lang";
import Router from "../router";
import {
    SoundToolApps,
    ToolApps,
    VideoProcessingApps,
    GeneralApps,
} from "./Apps/all";
import { testActionSet, testActionUnset } from "../utils/test";

const tab = ref("");

const groups = computed(() => [
    { title: t("general.model.group") || "通用", apps: GeneralApps },
    { title: t("tool.soundProcessing"), apps: SoundToolApps },
    { title: t("tool.imageGeneration"), apps: ToolApps },
    { title: t("tool.videoProcessing"), apps: VideoProcessingApps },
]);

const allToolApps = [
    ...SoundToolApps,
    ...ToolApps,
    ...VideoProcessingApps,
    ...GeneralApps,
];

const syncTab = () => {
    const next =
        (Router.currentRoute.value.query.tab as string) ||
        getNavTab("/tool") ||
        "SoundAsr";
    tab.value = allToolApps.some((a) => a.name === next) ? next : "SoundAsr";
};

watch(tab, (v) => {
    if (v) {
        rememberNavTab("/tool", v);
    }
});

onMounted(() => {
    syncTab();
    testActionSet("page.ready", () => {});
    testActionSet("page.tab", () => tab.value);
});

onUnmounted(() => {
    testActionUnset(["page.ready", "page.tab"]);
});

watch(() => Router.currentRoute.value.query.tab, syncTab);

const dynamicComponent = computed(() => {
    for (const app of allToolApps) {
        if (app.name === tab.value) {
            return app.component;
        }
    }
    return null;
});
</script>

<template>
    <div
        class="pb-device-container bg-white dark:bg-gray-900 h-full relative select-none flex"
    >
        <div
            class="w-52 flex-shrink-0 border-r border-solid border-gray-100 overflow-x-hidden overflow-y-auto"
        >
            <template v-for="group in groups" :key="group.title">
                <div class="px-4 pt-4 pb-1 text-xs text-gray-400">
                    {{ group.title }}
                </div>
                <div class="px-3">
                    <div
                        v-for="s in group.apps"
                        :key="s.name"
                        class="p-2 rounded-lg mb-1 cursor-pointer"
                        :class="
                            tab === s.name
                                ? 'menu-item-active'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                        "
                        @click="tab = s.name"
                    >
                        <div class="text-base truncate flex items-center">
                            <component
                                :is="
                                    typeof s.icon === 'string' ? 'img' : s.icon
                                "
                                :src="
                                    typeof s.icon === 'string'
                                        ? s.icon
                                        : undefined
                                "
                                class="w-5 h-5 mr-1 object-contain flex-shrink-0"
                                :style="
                                    typeof s.icon === 'string'
                                        ? {}
                                        : { color: s.color }
                                "
                            />
                            {{ t(s.titleKey) }}
                        </div>
                    </div>
                </div>
            </template>
        </div>
        <div class="flex-grow h-full overflow-y-auto">
            <component :is="dynamicComponent" />
        </div>
    </div>
</template>

<style scoped></style>
