<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from "vue";
import FeedbackTicketButton from "../components/common/FeedbackTicketButton.vue";


import { TimeUtil } from "../lib/util";
import { AppConfig } from "../config";
import { t } from "../lang";
import { TaskService } from "../service/TaskService";

import { StorageService } from "../service/StorageService";
import { VideoTemplateService } from "../service/VideoTemplateService";
import Router from "../router";
import { AllApps } from "./Apps/all";
import { testActionSet, testActionUnset } from "../utils/test";



const usageData = ref({
    soundGenerate: undefined as undefined | number,
    soundGenerateToday: undefined as undefined | number,
    videoTemplateCount: undefined as undefined | number,
    videoGen: undefined as undefined | number,
    videoGenToday: undefined as undefined | number,
    toolTotal: undefined as undefined | number,
    toolTotalToday: undefined as undefined | number,
    
    liveAvatarCount: undefined as undefined | number,
    liveKnowledgeCount: undefined as undefined | number,
});

const doUrl = (url: string) => {
    if (url.startsWith("http")) {
        window.$mapi.app.openExternal(url);
    } else {
        Router.push(url);
    }
};

onMounted(async () => {
    testActionSet("page.ready", () => {});
    nextTick(async () => {
        const todayStart = TimeUtil.formatDate(Date.now()) + " 00:00:00";
        const todayStartTimestamp = TimeUtil.datetimeToTimestamp(todayStart);
        const [
            soundGenerate,
            soundGenerateToday,
            videoTemplateCount,
            videoGen,
            videoGenToday,
            taskTotal,
            taskTotalToday,
            liveAvatarCount,
            liveKnowledgeCount,
        ] = await Promise.all([
            TaskService.count("SoundGenerate"),
            TaskService.count("SoundGenerate", todayStartTimestamp),
            VideoTemplateService.count(),
            TaskService.count("VideoGen"),
            TaskService.count("VideoGen", todayStartTimestamp),
            TaskService.count(null),
            TaskService.count(null, todayStartTimestamp),
            StorageService.count("LiveAvatar"),
            StorageService.count("LiveKnowledge"),
        ]);
        usageData.value.soundGenerate = soundGenerate;
        usageData.value.soundGenerateToday = soundGenerateToday;
        usageData.value.videoTemplateCount = videoTemplateCount;
        usageData.value.videoGen = videoGen;
        usageData.value.videoGenToday = videoGenToday;
        usageData.value.toolTotal = Math.max(
            0,
            taskTotal - soundGenerate - videoGen,
        );
        usageData.value.toolTotalToday = Math.max(
            0,
            taskTotalToday - soundGenerateToday - videoGenToday,
        );
        usageData.value.liveAvatarCount = liveAvatarCount;
        usageData.value.liveKnowledgeCount = liveKnowledgeCount;
        
    });
});

onUnmounted(() => {
    testActionUnset("page.ready");
});
</script>

<template>
    <div
        class="page-narrow-container p-6 pb-home h-full overflow-hidden overflow-y-auto bg-gray-50 dark:bg-gray-900"
    >
        <!-- 标题 -->
        <div class="flex items-center mb-6">
            <div
                class="text-2xl font-bold flex-grow text-gray-800 dark:text-gray-100"
            >
                {{ $t("welcome.title") }}
            </div>
            <a
                target="_blank"
                class="text-gray-500 hover:text-blue-500 transition-colors text-sm flex items-center"
                href="https://aigcpanel.com/forum"
            >
                <icon-message class="mr-1" />
                {{ $t("feedback.help") }}
            </a>
        </div>

        <!-- 导航卡片 -->
        <div class="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div
                class="bg-white dark:bg-gray-800 rounded-xl p-5 cursor-pointer hover:shadow-md border border-gray-100 dark:border-gray-700 transition-all group flex items-center justify-between relative overflow-hidden"
                data-nav="soundGenerate"
                @click="$router.push('/video?tab=soundGenerate')"
            >
                <div class="flex-grow z-10 w-0">
                    <div
                        class="font-bold text-gray-800 dark:text-gray-200 text-base mb-1"
                    >
                        {{ $t("home.soundGenerate") }}
                    </div>
                    <div class="text-gray-500 text-xs truncate pr-2">
                        {{ $t("intro.modelsSupported") }}
                    </div>
                </div>
                <div
                    class="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0 group-hover:scale-125 group-hover:rotate-12 transition-all duration-300"
                >
                    <i-mdi-waveform class="text-indigo-500 text-2xl" />
                </div>
            </div>
            <div
                class="bg-white dark:bg-gray-800 rounded-xl p-5 cursor-pointer hover:shadow-md border border-gray-100 dark:border-gray-700 transition-all group flex items-center justify-between relative overflow-hidden"
                data-nav="videoGen"
                @click="$router.push('/video?tab=videoGen')"
            >
                <div class="flex-grow z-10 w-0">
                    <div
                        class="font-bold text-gray-800 dark:text-gray-200 text-base mb-1"
                    >
                        {{ $t("home.videoGen") }}
                    </div>
                    <div class="text-gray-500 text-xs truncate pr-2">
                        {{ $t("avatar.audioToVideo") }}
                    </div>
                </div>
                <div
                    class="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 group-hover:scale-125 group-hover:rotate-12 transition-all duration-300"
                >
                    <i-mdi-video-account class="text-blue-500 text-2xl" />
                </div>
            </div>
            <div
                class="bg-white dark:bg-gray-800 rounded-xl p-5 cursor-pointer hover:shadow-md border border-gray-100 dark:border-gray-700 transition-all group flex items-center justify-between relative overflow-hidden"
                data-nav="tool"
                @click="$router.push('/tool')"
            >
                <div class="flex-grow z-10 w-0">
                    <div
                        class="font-bold text-gray-800 dark:text-gray-200 text-base mb-1"
                    >
                        {{ $t("home.tool") }}
                    </div>
                    <div class="text-gray-500 text-xs truncate pr-2">
                        {{ $t("home.toolDesc") }}
                    </div>
                </div>
                <div
                    class="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0 group-hover:scale-125 group-hover:rotate-12 transition-all duration-300"
                >
                    <icon-tool class="text-amber-500 text-2xl" />
                </div>
            </div>
            
            <div
                class="bg-white dark:bg-gray-800 rounded-xl p-5 cursor-pointer hover:shadow-md border border-gray-100 dark:border-gray-700 transition-all group flex items-center justify-between relative overflow-hidden"
                data-nav="live"
                @click="$router.push('/live')"
            >
                <div class="flex-grow z-10 w-0">
                    <div
                        class="font-bold text-gray-800 dark:text-gray-200 text-base mb-1"
                    >
                        {{ $t("home.live") }}
                    </div>
                    <div class="text-gray-500 text-xs truncate pr-2">
                        {{ $t("intro.interactionSupport") }}
                    </div>
                </div>
                <div
                    class="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center flex-shrink-0 group-hover:scale-125 group-hover:rotate-12 transition-all duration-300"
                >
                    <icon-live-broadcast class="text-rose-500 text-2xl" />
                </div>
            </div>
        </div>

        <!-- 数据统计 -->
        <div
            class="bg-white dark:bg-gray-800 rounded-xl p-5 mb-6 border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow"
        >
            <div
                class="text-base font-bold mb-4 flex items-center gap-2 text-gray-800 dark:text-gray-200"
            >
                <icon-bar-chart />
                {{ $t("dashboard.statistics") }}
            </div>
            <div class="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <!-- 语音合成 -->
                <div
                    class="flex flex-col gap-2 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20"
                >
                    <div class="flex items-center gap-1.5">
                        <span
                            class="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0"
                        ></span>
                        <span
                            class="text-xs font-medium text-gray-600 dark:text-gray-400"
                            >{{ $t("home.soundGenerate") }}</span
                        >
                    </div>
                    <div class="flex items-end gap-4">
                        <div>
                            <div
                                class="text-xl font-bold text-gray-800 dark:text-gray-100"
                            >
                                {{ usageData.soundGenerate ?? "-" }}
                            </div>
                            <div class="text-xs text-gray-400">
                                {{ $t("dashboard.total") }}
                            </div>
                        </div>
                        <div>
                            <div
                                class="text-xl font-bold"
                                :class="
                                    (usageData.soundGenerateToday ?? 0) > 0
                                        ? 'text-emerald-500'
                                        : 'text-gray-400'
                                "
                            >
                                +{{ usageData.soundGenerateToday ?? "-" }}
                            </div>
                            <div class="text-xs text-gray-400">
                                {{ $t("dashboard.today") }}
                            </div>
                        </div>
                    </div>
                </div>
                <!-- 数字人合成 -->
                <div
                    class="flex flex-col gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20"
                >
                    <div class="flex items-center gap-1.5">
                        <span
                            class="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"
                        ></span>
                        <span
                            class="text-xs font-medium text-gray-600 dark:text-gray-400"
                            >{{ $t("home.videoGen") }}</span
                        >
                    </div>
                    <div class="flex items-end gap-4">
                        <div>
                            <div
                                class="text-xl font-bold text-gray-800 dark:text-gray-100"
                            >
                                {{ usageData.videoGen ?? "-" }}
                            </div>
                            <div class="text-xs text-gray-400">
                                {{ $t("dashboard.total") }}
                            </div>
                        </div>
                        <div>
                            <div
                                class="text-xl font-bold"
                                :class="
                                    (usageData.videoGenToday ?? 0) > 0
                                        ? 'text-emerald-500'
                                        : 'text-gray-400'
                                "
                            >
                                +{{ usageData.videoGenToday ?? "-" }}
                            </div>
                            <div class="text-xs text-gray-400">
                                {{ $t("dashboard.today") }}
                            </div>
                        </div>
                        <div class="ml-auto self-start">
                            <div class="text-xs text-gray-400">
                                {{
                                    $t("home.templateCountValue", {
                                        count:
                                            usageData.videoTemplateCount ?? "-",
                                    })
                                }}
                            </div>
                        </div>
                    </div>
                </div>
                <!-- 工具 -->
                <div
                    class="flex flex-col gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20"
                >
                    <div class="flex items-center gap-1.5">
                        <span
                            class="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0"
                        ></span>
                        <span
                            class="text-xs font-medium text-gray-600 dark:text-gray-400"
                            >{{ $t("home.tool") }}</span
                        >
                    </div>
                    <div class="flex items-end gap-4">
                        <div>
                            <div
                                class="text-xl font-bold text-gray-800 dark:text-gray-100"
                            >
                                {{ usageData.toolTotal ?? "-" }}
                            </div>
                            <div class="text-xs text-gray-400">
                                {{ $t("dashboard.total") }}
                            </div>
                        </div>
                        <div>
                            <div
                                class="text-xl font-bold"
                                :class="
                                    (usageData.toolTotalToday ?? 0) > 0
                                        ? 'text-emerald-500'
                                        : 'text-gray-400'
                                "
                            >
                                +{{ usageData.toolTotalToday ?? "-" }}
                            </div>
                            <div class="text-xs text-gray-400">
                                {{ $t("dashboard.today") }}
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 智能直播 -->
                <div
                    class="flex flex-col gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20"
                >
                    <div class="flex items-center gap-1.5">
                        <span
                            class="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0"
                        ></span>
                        <span
                            class="text-xs font-medium text-gray-600 dark:text-gray-400"
                            >{{ $t("home.live") }}</span
                        >
                    </div>
                    <div class="flex items-end gap-4">
                        <div>
                            <div
                                class="text-xl font-bold text-gray-800 dark:text-gray-100"
                            >
                                {{ usageData.liveAvatarCount ?? "-" }}
                            </div>
                            <div class="text-xs text-gray-400">
                                {{ $t("home.avatar") }}
                            </div>
                        </div>
                        <div>
                            <div
                                class="text-xl font-bold text-gray-800 dark:text-gray-100"
                            >
                                {{ usageData.liveKnowledgeCount ?? "-" }}
                            </div>
                            <div class="text-xs text-gray-400">
                                {{ $t("home.knowledgeBase") }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 云端 AI 模型 / 模型市场 / 工单反馈 -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            

            <a
                href="https://aigcpanel.com/zh/asset"
                target="_blank"
                class="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center hover:shadow-md border border-gray-100 dark:border-gray-700 transition-all group"
            >
                <div
                    class="w-14 h-14 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center mr-3 flex-shrink-0 text-emerald-500"
                >
                    <icon-apps class="text-2xl" />
                </div>
                <div class="flex-grow">
                    <div
                        class="font-medium text-sm text-gray-800 dark:text-gray-200"
                    >
                        {{ $t("model.market") }}
                    </div>
                    <div class="text-gray-400 text-xs mt-0.5">
                        {{ $t("intro.modelsUpdate") }}
                    </div>
                </div>
                <icon-right
                    class="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                />
            </a>

            <div
                class="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center hover:shadow-md border border-gray-100 dark:border-gray-700 transition-all group"
            >
                <div
                    class="w-14 h-14 rounded-lg bg-gray-50 dark:bg-gray-700 flex items-center justify-center mr-3 flex-shrink-0 text-gray-500 dark:text-gray-400"
                >
                    <icon-message class="text-2xl" />
                </div>
                <div class="flex-grow">
                    <div
                        class="font-medium text-sm text-gray-800 dark:text-gray-200"
                    >
                        {{ $t("nav.feedback") }}
                    </div>
                    <div class="text-gray-400 text-xs mt-0.5">
                        {{ $t("feedback.anytime") }}
                    </div>
                </div>
                <FeedbackTicketButton />
            </div>
        </div>

        <!-- 工具功能卡片 -->
        <div
            class="bg-white dark:bg-gray-800 rounded-xl p-5 mb-5 border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow"
        >
            <div
                class="text-base font-bold mb-4 flex items-center gap-2 text-gray-800 dark:text-gray-200"
            >
                <icon-tool />
                {{ $t("home.tool") }}
            </div>
            <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <div
                    v-for="(app, index) in AllApps"
                    :key="index"
                    class="flex items-center gap-4 px-4 py-3 rounded-xl border border-gray-100 dark:border-gray-700 cursor-pointer hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all group"
                    :data-app="app.name ?? index"
                    @click="doUrl(app.url)"
                >
                    <div
                        class="w-10 h-10 rounded-lg bg-gray-50 dark:bg-gray-700/60 flex items-center justify-center flex-shrink-0"
                    >
                        <component
                            :is="
                                typeof app.icon === 'string' ? 'img' : app.icon
                            "
                            :src="
                                typeof app.icon === 'string'
                                    ? app.icon
                                    : undefined
                            "
                            class="w-6 h-6 object-contain opacity-80 group-hover:opacity-100 transition-opacity"
                            :style="
                                typeof app.icon === 'string'
                                    ? {}
                                    : { color: app.color }
                            "
                        />
                    </div>
                    <div class="min-w-0 flex-grow">
                        <div
                            class="font-medium text-sm text-gray-700 dark:text-gray-300 truncate"
                        >
                            {{ t(app.titleKey) }}
                        </div>
                        <div class="text-gray-400 text-xs truncate mt-0.5">
                            {{ t(app.descriptionKey) }}
                        </div>
                    </div>
                    <icon-right
                        class="text-gray-300 dark:text-gray-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                </div>
            </div>
        </div>
        <!-- 开源地址（地址始终为 github.com/modstart-lib/aigcpanel） -->
        <div
            class="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-xs text-gray-400"
        >
            <span class="flex items-center gap-1">
                <i-mdi-open-source-initiative class="text-sm" />
                {{ $t("home.openSource") }}
            </span>
            <a
                :href="AppConfig.websiteGithub"
                target="_blank"
                class="flex items-center gap-1 text-gray-500 dark:text-gray-300 hover:text-blue-500 transition-colors"
            >
                <i-mdi-github class="text-sm" />
                modstart-lib/aigcpanel
            </a>
        </div>
    </div>
    
</template>

<style scoped></style>
