<script setup lang="ts">
import {nextTick, onMounted, ref} from "vue";
import FeedbackTicketButton from "../components/common/FeedbackTicketButton.vue";
import {TimeUtil} from "../lib/util";
import {TaskService} from "../service/TaskService";
import Router from "../router";
import {AllApps} from "./Apps/all";

const loading = ref(true);

const usageData = ref({
    soundGenerate: undefined as undefined | number,
    soundGenerateToday: undefined as undefined | number,
    soundAsr: undefined as undefined | number,
    soundAsrToday: undefined as undefined | number,
    videoGen: undefined as undefined | number,
    videoGenToday: undefined as undefined | number,
    taskTotal: undefined as undefined | number,
    taskTotalToday: undefined as undefined | number,
});

const doUrl = (url: string) => {
    if (url.startsWith("http")) {
        window.$mapi.app.openExternal(url);
    } else {
        Router.push(url);
    }
};

onMounted(async () => {
    loading.value = false;
    nextTick(async () => {
        const todayStart = TimeUtil.formatDate(Date.now()) + " 00:00:00";
        const todayStartTimestamp = TimeUtil.datetimeToTimestamp(todayStart);
        usageData.value.soundGenerate = await TaskService.count("SoundGenerate");
        usageData.value.soundGenerateToday = await TaskService.count("SoundGenerate", todayStartTimestamp);
        usageData.value.soundAsr = await TaskService.count("SoundAsr");
        usageData.value.soundAsrToday = await TaskService.count("SoundAsr", todayStartTimestamp);
        usageData.value.videoGen = await TaskService.count("VideoGen");
        usageData.value.videoGenToday = await TaskService.count("VideoGen", todayStartTimestamp);
        usageData.value.taskTotal = await TaskService.count(null);
        usageData.value.taskTotalToday = await TaskService.count(null, todayStartTimestamp);
    });
});
</script>

<template>
    <div class="page-narrow-container p-6 pb-home h-full overflow-hidden overflow-y-auto">
        <div class="flex">
            <div class="text-3xl font-bold mb-5 flex-grow">
                {{ $t("welcome.title") }}
            </div>
            <div>
                <a target="_blank" class="text-red-500" href="https://aigcpanel.com/forum">
                    <icon-message class="mr-1" />
                    {{ $t("feedback.help") }}
                </a>
            </div>
        </div>
        <div class="mb-5">
            <div class="flex gap-5 pb-top-area">
                <div class="flex-grow w-0 bg-white rounded-lg p-3 bg-contain bg-right bg-no-repeat hover:shadow-lg">
                    <div class="font-bold text-xl mb-1">{{ $t("voice.synthesis") }}</div>
                    <div class="h-8 truncate overflow-hidden text-gray-500">
                        {{ $t("intro.modelsSupported") }}
                    </div>
                    <div>
                        <a-button type="primary" @click="$router.push('/sound?tab=soundGenerate')">
                            {{ $t("common.useNow") }}
                        </a-button>
                    </div>
                </div>
                <div class="flex-grow w-0 bg-white rounded-lg p-3 bg-contain bg-right bg-no-repeat hover:shadow-lg">
                    <div class="font-bold text-xl mb-1">{{ $t("voice.recognition") }}</div>
                    <div class="h-8 truncate overflow-hidden text-gray-500">
                        {{ $t("desc.recognitionDownload") }}
                    </div>
                    <div>
                        <a-button type="primary" @click="$router.push('/sound?tab=soundAsr')">
                            {{ $t("common.useNow") }}
                        </a-button>
                    </div>
                </div>
                <div class="flex-grow w-0 bg-white rounded-lg p-3 bg-contain bg-right bg-no-repeat hover:shadow-lg">
                    <div class="font-bold text-xl mb-1">{{ $t("avatar.synthesis") }}</div>
                    <div class="h-8 truncate overflow-hidden text-gray-500">
                        {{ $t("avatar.audioToVideo") }}
                    </div>
                    <div>
                        <a-button type="primary" @click="$router.push('/video?tab=videoGen')">
                            {{ $t("common.useNow") }}
                        </a-button>
                    </div>
                </div>
                <div class="flex-grow w-0 bg-white rounded-lg p-3 bg-contain bg-right bg-no-repeat hover:shadow-lg">
                    <div class="font-bold text-xl mb-1">{{ $t("avatar.live") }}</div>
                    <div class="h-8 truncate overflow-hidden text-gray-500">
                        {{ $t("intro.interactionSupport") }}
                    </div>
                    <div>
                        <a-button type="primary" @click="$router.push('/live')">
                            {{ $t("common.useNow") }}
                        </a-button>
                    </div>
                </div>
            </div>
        </div>
        <div class="bg-white rounded-lg p-4 mb-5 hover:shadow-lg">
            <div class="text-xl font-bold mb-4">
                <icon-bar-chart />
                {{ $t("dashboard.statistics") }}
            </div>
            <div class="flex">
                <div class="flex-grow w-0">
                    <div class="mb-3">
                        {{ $t("voice.synthesis") }}
                    </div>
                    <div class="font-bold text-2xl mb-3">
                        <a-statistic animation placeholder="-" :value="usageData.soundGenerate as any" />
                    </div>
                    <div>
                        {{ $t("dashboard.today") }} +
                        <a-statistic
                            animation
                            placeholder="-"
                            :value-style="{
                                color:
                                    usageData.soundGenerateToday && usageData.soundGenerateToday > 0 ? 'green' : 'gray',
                                fontSize: '14px',
                            }"
                            :value="usageData.soundGenerateToday as any"
                        />
                    </div>
                </div>
                <div class="flex-grow w-0">
                    <div class="mb-3">
                        {{ $t("voice.recognition") }}
                    </div>
                    <div class="font-bold text-2xl mb-3">
                        <a-statistic animation placeholder="-" :value="usageData.soundAsr as any" />
                    </div>
                    <div>
                        {{ $t("dashboard.today") }} +
                        <a-statistic
                            animation
                            placeholder="-"
                            :value-style="{
                                color: usageData.soundAsrToday && usageData.soundAsrToday > 0 ? 'green' : 'gray',
                                fontSize: '14px',
                            }"
                            :value="usageData.soundAsrToday as any"
                        />
                    </div>
                </div>
                <div class="flex-grow w-0">
                    <div class="mb-3">
                        {{ $t("avatar.synthesis") }}
                    </div>
                    <div class="font-bold text-2xl mb-3">
                        <a-statistic animation placeholder="-" :value="usageData.videoGen as any" />
                    </div>
                    <div>
                        {{ $t("dashboard.today") }} +
                        <a-statistic
                            animation
                            placeholder="-"
                            :value-style="{
                                color: usageData.videoGenToday && usageData.videoGenToday > 0 ? 'green' : 'gray',
                                fontSize: '14px',
                            }"
                            :value="usageData.videoGenToday as any"
                        />
                    </div>
                </div>
                <div class="flex-grow w-0">
                    <div class="mb-3">
                        {{ $t("dashboard.todayTotalTasks") }}
                    </div>
                    <div class="font-bold text-2xl mb-3">
                        <a-statistic animation placeholder="-" :value="usageData.taskTotal as any" />
                    </div>
                    <div>
                        {{ $t("dashboard.today") }} +
                        <a-statistic
                            animation
                            placeholder="-"
                            :value-style="{
                                color: usageData.taskTotalToday && usageData.taskTotalToday > 0 ? 'green' : 'gray',
                                fontSize: '14px',
                            }"
                            :value="usageData.taskTotalToday as any"
                        />
                    </div>
                </div>
            </div>
        </div>
        <div class="mb-4">
            <div class="flex gap-5">
                <a
                    href="https://aigcpanel.com/zh/asset"
                    target="_blank"
                    class="bg-white rounded-lg p-3 flex items-center flex-grow w-0 hover:shadow-lg"
                >
                    <div class="flex-grow">
                        <div class="font-bold text-xl mb-3">
                            {{ $t("model.market") }}
                        </div>
                        <div class="text-gray-600">
                            {{ $t("intro.modelsUpdate") }}
                        </div>
                    </div>
                    <div>
                        <icon-right class="text-2xl text-gray-400" />
                    </div>
                </a>
                <div class="bg-white rounded-lg p-3 flex items-center flex-grow w-0 hover:shadow-lg">
                    <div class="flex-grow">
                        <div class="font-bold text-xl mb-3">
                            {{ $t("nav.feedback") }}
                        </div>
                        <div class="text-gray-600">
                            {{ $t("feedback.anytime") }}
                        </div>
                    </div>
                    <div>
                        <FeedbackTicketButton />
                    </div>
                </div>
            </div>
        </div>
        <div class="bg-white rounded-lg p-4 mb-5">
            <div class="text-xl font-bold mb-4">
                <icon-tool />
                {{ $t("nav.apps") }}
            </div>
            <div class="flex flex-wrap gap-5 mt-3">
                <div
                    v-for="(app, index) in AllApps"
                    :key="index"
                    class="bg-white rounded-lg p-3 flex items-center flex-grow w-64 cursor-pointer border hover:shadow-xl"
                    @click="doUrl(app.url)"
                >
                    <div>
                        <img :src="app.icon" class="w-8 h-8 object-contain mr-3" />
                    </div>
                    <div class="flex-grow">
                        <div class="font-bold text-lg mb-1">{{ app.title }}</div>
                        <div class="h-8 truncate overflow-hidden text-gray-500">
                            {{ app.description }}
                        </div>
                    </div>
                    <div>
                        <icon-right class="text-gray-400" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style lang="less" scoped>
.pb-top-area > div {
    background-size: 3rem;
    background-position: 95% center;

    &:nth-child(1) {
        background-image: url(./../assets/image/icon/soundGenerate.png);
    }

    &:nth-child(2) {
        background-image: url(./../assets/image/icon/soundAsr.png);
    }

    &:nth-child(3) {
        background-image: url(./../assets/image/icon/videoGen.png);
    }

    &:nth-child(4) {
        background-image: url(./../assets/image/icon/live.png);
    }
}
</style>
