<script setup lang="ts">
import {computed, onMounted, ref} from "vue";
import {t} from "../lang";
import Router from "../router";
import VideoGen from "./Video/VideoGen.vue";
import VideoTemplate from "./Video/VideoTemplate.vue";
import {VideoApps} from "./Apps/all";

const tab = ref("");

onMounted(() => {
    tab.value = (Router.currentRoute.value.query.tab as string) || "videoGen";
});

const dynamicComponent = computed(() => {
    for (const app of VideoApps) {
        if (app.name === tab.value) {
            return app.component;
        }
    }
    return null;
});
</script>

<template>
    <div class="pb-device-container bg-white h-full relative select-none flex">
        <div class="p-6 w-52 flex-shrink-0 border-r border-solid border-gray-100 overflow-x-hidden overflow-y-auto">
            <div
                class="p-2 rounded-lg mb-4 cursor-pointer"
                :class="tab === 'videoGen' ? 'bg-gray-200' : ''"
                @click="tab = 'videoGen'"
            >
                <div class="text-base truncate flex items-center">
                    <i class="iconfont icon-video w-6 inline-block"></i>
                    {{ t("avatar.synthesis") }}
                </div>
            </div>
            <div
                class="p-2 rounded-lg mb-4 cursor-pointer"
                :class="tab === 'videoTemplate' ? 'bg-gray-200' : ''"
                @click="tab = 'videoTemplate'"
            >
                <div class="text-base truncate flex items-center">
                    <i class="iconfont icon-video-template w-6 inline-block"></i>
                    {{ t("avatar.avatar") }}
                </div>
            </div>
            <div
                v-for="s in VideoApps"
                class="p-2 rounded-lg mb-4 cursor-pointer"
                :class="tab === s.name ? 'bg-gray-200' : ''"
                @click="tab = s.name"
            >
                <div class="text-base truncate flex items-center">
                    <img :src="s.icon" class="w-4 h-4 mr-2 object-contain"/>
                    {{ s.title }}
                </div>
            </div>
        </div>
        <div class="flex-grow h-full overflow-y-auto">
            <VideoGen v-if="tab === 'videoGen'"/>
            <VideoTemplate v-else-if="tab === 'videoTemplate'"/>
            <component v-else :is="dynamicComponent"/>
        </div>
    </div>
</template>

<style scoped></style>
