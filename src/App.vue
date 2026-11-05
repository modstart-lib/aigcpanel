<template>
    <a-config-provider :locale="locale" :global="true">
        <router-view></router-view>
        <UpdateDialog />
        <UpdateFloatBar />
    </a-config-provider>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { onLocaleChange } from "./lang";
import UpdateDialog from "./components/common/UpdateDialog.vue";
import UpdateFloatBar from "./components/common/UpdateFloatBar.vue";

import zhCN from "@arco-design/web-vue/es/locale/lang/zh-cn";
import enUS from "@arco-design/web-vue/es/locale/lang/en-us";
import { doCheckForUpdate } from "./components/common/util";

const locales = {
    "zh-CN": zhCN,
    "en-US": enUS,
};

const locale = ref(zhCN);
onLocaleChange((newLocale) => {
    locale.value = locales[newLocale];
});

onMounted(() => {
    setTimeout(async () => {
        const checkAtLaunch = await window.$mapi.config.get(
            "updaterCheckAtLaunch",
            "yes",
        );
        if ("yes" !== checkAtLaunch) {
            return;
        }
        doCheckForUpdate().then();
    }, 6000);
});
</script>
