<script setup lang="ts">
import { AppConfig } from "../../config";
import upgradeSvg from "../../assets/image/upgrade.svg";
</script>

<template>
    <div class="pro-upgrade-container h-full w-full flex items-center justify-center p-4">
        <div class="text-center py-16 px-12 bg-white rounded-xl shadow-sm border border-gray-100 max-w-md w-full transition-all hover:shadow-md">
            <div class="text-center mb-8 relative">
                <div class="absolute inset-0 bg-blue-50 rounded-full opacity-20 transform scale-150"></div>
                <img class="w-24 h-24 mx-auto relative z-10 opacity-90" :src="upgradeSvg" alt="Upgrade" />
            </div>
            <h3 class="text-xl font-bold text-gray-800 mb-3">功能升级提示</h3>
            <p class="text-gray-500 mb-8 leading-relaxed">请下载 Pro 版本解锁完整的直播功能体验</p>
            <div>
                <a
                    class="arco-btn arco-btn-size-large arco-btn-primary px-8 rounded-full shadow-blue-200 shadow-lg hover:shadow-xl transition-all"
                    :href="AppConfig.website"
                    target="_blank"
                >
                    <icon-link />
                    <span class="ml-2">立即下载 Pro 版本</span>
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
