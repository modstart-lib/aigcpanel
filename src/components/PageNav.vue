<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { AppConfig } from "../config";
import { useUserStore } from "../store/modules/user";
import { t } from "../lang";
import { useSettingStore } from "../store/modules/setting";
import WorkflowIcon from "./Icon/WorkflowIcon.vue";

const route = useRouter();
const user = useUserStore();
const setting = useSettingStore();

const activeTab = computed(() => {
    const path = route.currentRoute.value.path;
    if (path === "/" || path === "/home") return "home";
    if (path === "/server") return "server";
    if (path === "/setting") return "setting";
    if (path === "/video") return "video";
    if (path === "/live") return "live";
    if (path === "/tool") return "tool";
    if (path.startsWith("/workflow")) return "workflow";
});

const userTip = computed(() => {
    return user.user.id ? user.user.name : t("common.notLoggedIn");
});

const doUser = async () => {
    if (!setting.basic.userEnable) {
        return;
    }
    await window.$mapi.user.open();
};
</script>

<template>
    <div
        class="flex flex-col h-full border-r border-gray-200 dark:border-gray-600"
    >
        <div
            class="py-4 px-3"
            :class="setting.basic.userEnable ? 'cursor-pointer' : ''"
            @click="doUser"
        >
            <a-tooltip
                v-if="setting.basic.userEnable"
                :content="userTip as string"
                position="right"
                mini
            >
                <div class="relative w-10 h-10">
                    <img
                        v-if="!user.isInit || !user.user.id"
                        class="rounded-full border border-solid border-gray-200 w-10 h-10 shadow-lg"
                        src="./../assets/image/avatar.svg"
                    />
                    <img
                        v-else
                        :src="user.user.avatar as string"
                        class="rounded-full border border-solid border-gray-200 w-10 h-10 shadow-lg"
                    />
                    
                </div>
            </a-tooltip>
            <div v-else>
                <div class="relative w-10 h-10">
                    <img
                        v-if="!user.isInit || !user.user.id"
                        class="rounded-full border border-solid border-gray-200 w-10 h-10 shadow-lg"
                        src="./../assets/image/avatar.svg"
                    />
                    <img
                        v-else
                        :src="user.user.avatar as string"
                        class="rounded-full border border-solid border-gray-200 w-10 h-10 shadow-lg"
                    />
                    
                </div>
            </div>
        </div>
        <div class="flex-grow mt-2">
            <a
                class="page-nav-item block text-center py-3"
                :class="activeTab === 'home' ? 'active' : ''"
                @click="$router.push('/')"
                href="javascript:;"
            >
                <div class="flex justify-center">
                    <icon-home class="text-xl" />
                </div>
                <div class="text-sm truncate">{{ $t("nav.home") }}</div>
            </a>
            <a
                class="page-nav-item block text-center py-3"
                :class="activeTab === 'video' ? 'active' : ''"
                @click="$router.push('/video')"
                href="javascript:;"
            >
                <div class="flex justify-center">
                    <i-mdi-account-circle-outline class="text-xl" />
                </div>
                <div class="text-sm truncate">{{ $t("nav.video") }}</div>
            </a>
            <a
                class="page-nav-item block text-center py-3"
                :class="activeTab === 'live' ? 'active' : ''"
                @click="$router.push('/live')"
                href="javascript:;"
            >
                <div class="flex justify-center">
                    <icon-live-broadcast class="text-xl" />
                </div>
                <div class="text-sm truncate">{{ $t("nav.live") }}</div>
            </a>
            <a
                class="page-nav-item block text-center py-3"
                :class="activeTab === 'tool' ? 'active' : ''"
                @click="$router.push('/tool')"
                href="javascript:;"
            >
                <div class="flex justify-center">
                    <icon-tool class="text-xl" />
                </div>
                <div class="text-sm truncate">{{ $t("nav.tool") }}</div>
            </a>
            <a
                class="page-nav-item block text-center py-3"
                :class="activeTab === 'workflow' ? 'active' : ''"
                @click="$router.push('/workflow')"
                href="javascript:;"
            >
                <div class="flex justify-center">
                    <WorkflowIcon class="h-5 w-5" />
                </div>
                <div class="text-sm truncate">{{ $t("nav.workflow") }}</div>
            </a>
            <a
                class="page-nav-item block text-center py-3"
                :class="activeTab === 'server' ? 'active' : ''"
                @click="$router.push('/server')"
                href="javascript:;"
            >
                <div class="flex justify-center">
                    <i-mdi-server-outline class="text-xl" />
                </div>
                <div class="text-sm truncate">{{ $t("nav.server") }}</div>
            </a>
            <a
                class="page-nav-item block text-center py-3"
                :class="activeTab === 'setting' ? 'active' : ''"
                @click="$router.push('/setting')"
                href="javascript:;"
            >
                <div class="flex justify-center">
                    <icon-settings class="text-xl" />
                </div>
                <div class="text-sm truncate">{{ $t("common.setting") }}</div>
            </a>
        </div>
        <div></div>
    </div>
</template>

<style scoped></style>
