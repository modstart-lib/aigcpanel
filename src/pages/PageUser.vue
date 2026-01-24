<script setup lang="ts">
import {onMounted, ref} from "vue";
import PageWebviewStatus from "../components/common/PageWebviewStatus.vue";
import {useUserPage} from "../hooks/user";

const status = ref<InstanceType<typeof PageWebviewStatus> | null>(null);
const web = ref<any | null>(null);

const {webPreload, webUrl, webUserAgent, user, canGoBack, doBack, onMount} = useUserPage({web, status});

onMounted(async () => {
    await onMount();
});
</script>

<template>
    <div class="pb-user-container relative">
        <div>
            <webview
                ref="web"
                :src="webUrl"
                nodeintegration
                :useragent="webUserAgent"
                :preload="webPreload"
                class="pb-user-web"
            ></webview>
            <div class="absolute left-5 top-5 z-40">
                <a-button v-if="canGoBack" @click="doBack" type="secondary" shape="round">
                    <template #icon>
                        <icon-left />
                    </template>
                    {{ $t("common.back") }}
                </a-button>
            </div>
        </div>
        <PageWebviewStatus ref="status" />
    </div>
</template>

<style lang="less" scoped>
.pb-user-container,
.pb-user-web {
    width: 100%;
    height: calc(100vh - 2.5rem);
}
</style>
