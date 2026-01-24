<script setup lang="ts">
import {computed, onMounted, ref} from "vue";
import {t} from "../lang";
import Router from "../router";
import SoundAsr from "./Sound/SoundAsr.vue";
import SoundGenerate from "./Sound/SoundGenerate.vue";
import {SoundApps} from "./Apps/all";

const tab = ref("");

onMounted(() => {
    tab.value = (Router.currentRoute.value.query.tab as string) || "soundGenerate";
});

const dynamicComponent = computed(() => {
    for (const app of SoundApps) {
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
                :class="tab === 'soundGenerate' ? 'bg-gray-200' : ''"
                @click="tab = 'soundGenerate'"
            >
                <div class="text-base truncate flex items-center">
                    <i class="iconfont icon-sound-generate w-6 inline-block"></i>
                    {{ t("voice.synthesis") }}
                </div>
            </div>
            <div
                class="p-2 rounded-lg mb-4 cursor-pointer"
                :class="tab === 'soundAsr' ? 'bg-gray-200' : ''"
                @click="tab = 'soundAsr'"
            >
                <div class="text-base truncate flex items-center">
                    <i class="iconfont icon-asr w-6 inline-block"></i>
                    {{ t("voice.recognition") }}
                </div>
            </div>
            <div
                v-for="s in SoundApps"
                class="p-2 rounded-lg mb-4 cursor-pointer"
                :class="tab === s.name ? 'bg-gray-200' : ''"
                @click="tab = s.name"
            >
                <div class="text-base truncate flex items-center">
                    <img :src="s.icon" class="w-4 h-4 mr-2 object-contain" />
                    {{ s.title }}
                </div>
            </div>
        </div>
        <div class="flex-grow h-full overflow-y-auto">
            <SoundGenerate v-if="tab === 'soundGenerate'" />
            <SoundAsr v-else-if="tab === 'soundAsr'" />
            <component v-else :is="dynamicComponent" />
        </div>
    </div>
</template>
