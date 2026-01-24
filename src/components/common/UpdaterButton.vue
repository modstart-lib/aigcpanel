<script setup lang="ts">
import {onMounted, ref} from "vue";
import {AppConfig} from "../../config";
import {doCheckForUpdate} from "./util";

const updaterCheckLoading = ref(false);
const checkAtLaunch = ref<"yes" | "no">("no");

onMounted(() => {
    loadCheckAtLaunch();
});

const loadCheckAtLaunch = async () => {
    checkAtLaunch.value = await window.$mapi.updater.getCheckAtLaunch();
};

const onCheckAtLaunchChange = async (value: boolean) => {
    await window.$mapi.updater.setCheckAtLaunch(value ? "yes" : "no");
    await loadCheckAtLaunch();
};

const doVersionCheck = async () => {
    updaterCheckLoading.value = true;
    await doCheckForUpdate(true);
    updaterCheckLoading.value = false;
};
</script>

<template>
    <div class="inline-flex items-center">
        <a-button
            v-if="!!AppConfig.updaterUrl"
            size="mini"
            class="mr-2"
            :loading="updaterCheckLoading"
            @click="doVersionCheck()"
        >
            {{ $t("update.check") }}
        </a-button>
        <a-checkbox :model-value="checkAtLaunch === 'yes'" @change="onCheckAtLaunchChange as any">
            {{ $t("setting.autoUpdate") }}
        </a-checkbox>
    </div>
</template>
