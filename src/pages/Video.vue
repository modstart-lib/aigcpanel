<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { t } from "../lang";
import Router from "../router";
import SoundGenerate from "./Video/SoundGenerate.vue";
import Voice from "./Video/Voice.vue";
import VideoGen from "./Video/VideoGen.vue";
import VideoTemplate from "./Video/VideoTemplate.vue";
import VideoGenFlow from "./Apps/VideoGenFlow/VideoGenFlow.vue";
import { testActionSet, testActionUnset } from "../utils/test";

const tab = ref("");
const VIDEO_TABS = [
    "soundGenerate",
    "voice",
    "videoGen",
    "videoTemplate",
    "VideoGenFlow",
];

const syncTab = () => {
    const next =
        (Router.currentRoute.value.query.tab as string) || "soundGenerate";
    tab.value = VIDEO_TABS.includes(next) ? next : "soundGenerate";
};

/**
 * Switch the secondary menu and sync the selected tab into the route query.
 * Otherwise the URL and the active tab drift apart: after visiting "voice"
 * and switching back to "soundGenerate" the URL still keeps ?tab=voice, so a
 * later entry such as "Voice Manage" pushes the same address and vue-router
 * treats it as a duplicated navigation and does nothing.
 */
const selectTab = (next: string) => {
    if (!VIDEO_TABS.includes(next)) {
        return;
    }
    tab.value = next;
    if (Router.currentRoute.value.query.tab === next) {
        return;
    }
    Router.push({ path: "/video", query: { tab: next } }).catch(() => {});
};

onMounted(() => {
    syncTab();
    testActionSet("page.ready", () => {});
    testActionSet("page.tab", () => tab.value);
});

onUnmounted(() => {
    testActionUnset(["page.ready", "page.tab"]);
});

watch(() => Router.currentRoute.value.query.tab, syncTab);
</script>

<template>
    <div class="pb-device-container bg-white h-full relative select-none flex">
        <div
            class="p-6 w-52 flex-shrink-0 border-r border-solid border-gray-100 overflow-x-hidden overflow-y-auto"
        >
            <div class="text-xs text-gray-400 mb-2 uppercase">
                {{ t("voice.voice") }}
            </div>
            <div
                class="p-2 rounded-lg mb-2 cursor-pointer"
                :class="tab === 'soundGenerate' ? 'menu-item-active' : ''"
                @click="selectTab('soundGenerate')"
            >
                <div class="text-base truncate flex items-center">
                    <i-mdi-waveform
                        class="w-5 h-5 inline-block text-indigo-500 mr-1"
                    />
                    {{ t("voice.synthesis") }}
                </div>
            </div>
            <div
                class="p-2 rounded-lg mb-2 cursor-pointer"
                :class="tab === 'voice' ? 'menu-item-active' : ''"
                @click="selectTab('voice')"
            >
                <div class="text-base truncate flex items-center">
                    <i-mdi-microphone
                        class="w-5 h-5 inline-block text-indigo-500 mr-1"
                    />
                    {{ t("soundVoice.title") }}
                </div>
            </div>
            <div class="text-xs text-gray-400 mb-2 mt-4 uppercase">
                {{ t("media.video") }}
            </div>
            <div
                class="p-2 rounded-lg mb-2 cursor-pointer"
                :class="tab === 'videoTemplate' ? 'menu-item-active' : ''"
                @click="selectTab('videoTemplate')"
            >
                <div class="text-base truncate flex items-center">
                    <i-mdi-account-box
                        class="w-5 h-5 inline-block text-blue-500 mr-1"
                    />
                    {{ t("avatar.avatar") }}
                </div>
            </div>
            <div
                class="p-2 rounded-lg mb-2 cursor-pointer"
                :class="tab === 'videoGen' ? 'menu-item-active' : ''"
                @click="selectTab('videoGen')"
            >
                <div class="text-base truncate flex items-center">
                    <i-mdi-video-account
                        class="w-5 h-5 inline-block text-violet-500 mr-1"
                    />
                    {{ t("avatar.synthesis") }}
                </div>
            </div>
            <div
                class="p-2 rounded-lg mb-2 cursor-pointer"
                :class="tab === 'VideoGenFlow' ? 'menu-item-active' : ''"
                @click="selectTab('VideoGenFlow')"
            >
                <div class="text-base truncate flex items-center">
                    <i-mdi-auto-fix
                        class="w-5 h-5 inline-block text-emerald-500 mr-1"
                    />
                    {{ t("avatar.oneClickSynthesis") }}
                </div>
            </div>
        </div>
        <div class="flex-grow h-full overflow-y-auto">
            <div v-if="tab === 'soundGenerate'">
                <SoundGenerate />
            </div>
            <div v-else-if="tab === 'voice'">
                <Voice />
            </div>
            <div v-else-if="tab === 'videoGen'">
                <VideoGen />
            </div>
            <div v-else-if="tab === 'videoTemplate'">
                <VideoTemplate />
            </div>
            <div v-else-if="tab === 'VideoGenFlow'">
                <VideoGenFlow />
            </div>
        </div>
    </div>
</template>
