<script setup lang="ts">
import { onMounted, ref } from "vue";
import { AppConfig } from "../../config";
import { t } from "../../lang";
import { updaterStore } from "../../store/modules/updater";

const store = updaterStore();
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
    await store.check(true);
};
</script>

<template>
    <div class="inline-flex items-center">
        <a-button
            v-if="!!AppConfig.updaterUrl"
            size="mini"
            class="mr-2"
            :loading="store.checking"
            @click="doVersionCheck()"
        >
            {{ $t("update.check") }}
        </a-button>
        <a-button
            v-if="store.updateAvailable && !store.isReady"
            type="primary"
            size="mini"
            class="mr-2"
            @click="store.show()"
        >
            {{ $t("update.downloadUpdate") }}
        </a-button>
        <a-button
            v-if="store.isReady"
            type="primary"
            size="mini"
            class="mr-2"
            @click="store.show()"
        >
            {{ $t("update.restartUpdate") }}
        </a-button>
        <a-checkbox
            :model-value="checkAtLaunch === 'yes'"
            @change="onCheckAtLaunchChange as any"
        >
            {{ $t("setting.autoUpdate") }}
        </a-checkbox>
    </div>
</template>
