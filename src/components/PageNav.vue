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

const userEnable = computed(() => !!setting.basic.userEnable);

const accountLabel = computed(() => {
    if (!user.isInit) {
        return "";
    }
    if (!user.user.id) {
        return t("nav.login");
    }
    const name = (user.user.name || "").trim();
    return name && name !== "-" ? name : t("nav.account");
});

const accountTip = computed(() => {
    if (!user.user.id) {
        return t("nav.loginTip");
    }
    return t("nav.userCenterTipName", { name: accountLabel.value });
});

const accountAriaLabel = computed(() => {
    return user.user.id
        ? t("nav.userCenterAria", { name: accountLabel.value })
        : t("nav.loginAria");
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
        <div class="px-2 pt-4 pb-2">
            <div
                v-if="userEnable"
                data-testid="nav-account"
                :data-state="user.user.id ? 'user' : 'guest'"
                class="flex flex-col items-center rounded-lg px-1 py-1 cursor-pointer select-none transition-colors hover:bg-[var(--color-bg-page-nav-active)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)]"
                role="button"
                tabindex="0"
                :aria-label="accountAriaLabel"
                @click="doUser"
                @keydown.enter.prevent="doUser"
                @keydown.space.prevent="doUser"
            >
                <a-tooltip :content="accountTip" position="right" mini>
                    <div class="flex w-full flex-col items-center">
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
                        <div
                            v-if="user.isInit"
                            data-testid="nav-account-label"
                            class="w-full text-center truncate"
                            :class="
                                user.user.id
                                    ? 'text-xs leading-4 text-gray-500 dark:text-gray-400'
                                    : 'text-sm leading-5 font-medium text-[color:var(--color-primary)] dark:text-[#9DBEFF]'
                            "
                        >
                            {{ accountLabel }}
                        </div>
                    </div>
                </a-tooltip>
            </div>
            <div v-else class="flex justify-center">
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
