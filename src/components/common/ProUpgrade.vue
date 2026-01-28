<script setup lang="ts">
import {AppConfig} from "../../config";
import {t} from "../../lang";

const props = defineProps({
    desc: {
        type: String,
        default: ""
    }
});
</script>

<template>
    <div class="pro-upgrade-container h-full w-full flex items-center justify-center p-4">
        <div
            class="text-center py-16 px-12 bg-white rounded-xl shadow-sm border border-gray-100 max-w-md w-full transition-all hover:shadow-md">
            <div class="text-center mb-8 relative">
                <svg t="1744854394926" class="mx-auto w-20 h-20" viewBox="0 0 1024 1024" version="1.1"
                     xmlns="http://www.w3.org/2000/svg" p-id="5741"
                     xmlns:xlink="http://www.w3.org/1999/xlink" width="256" height="256">
                    <path
                        d="M1024 512c0 282.784-229.216 512-512 512S0 794.784 0 512 229.216 0 512 0s512 229.216 512 512z"
                        fill="#F8BC4D" p-id="5742"></path>
                    <path
                        d="M598.56 581.504v137.728a32 32 0 0 1-32 32h-105.728a32 32 0 0 1-32-32v-137.728H314.784a28.48 28.48 0 0 1-22.688-45.728l198.752-261.536a28.48 28.48 0 0 1 45.472 0.16l195.68 261.536a28.48 28.48 0 0 1-22.816 45.536h-110.624z"
                        fill="#FFFFFF" p-id="5743"></path>
                </svg>
            </div>
            <h3 class="text-xl font-bold text-gray-800 mb-3">{{ $t("proUpgrade.title") }}</h3>
            <p class="text-gray-500 mb-8 leading-relaxed">{{ desc || $t("proUpgrade.defaultDesc") }}</p>
            <div>
                <a
                    class="arco-btn arco-btn-size-large arco-btn-primary px-8 rounded-full shadow-blue-200 shadow-lg hover:shadow-xl transition-all"
                    :href="AppConfig.website"
                    target="_blank"
                >
                    <icon-link/>
                    <span class="ml-2">{{ $t("proUpgrade.downloadButton") }}</span>
                </a>
            </div>
        </div>
    </div>
</template>

<style scoped>
.pro-upgrade-container {
    background-color: #f8fafc; /* subtle background for the whole area */
}
</style>
