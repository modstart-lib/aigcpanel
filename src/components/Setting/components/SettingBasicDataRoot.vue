<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { t } from "../../../lang";
import { testActionSet, testActionUnset } from "../../../utils/test";

// Effective data root directory and Electron default data root directory
const dataRoot = ref("");
const dataRootDefault = ref("");
const isCustom = ref(false);

const doLoad = async () => {
    dataRoot.value = await window.$mapi.file.dataRoot();
    dataRootDefault.value = await window.$mapi.file.dataRootDefault();
    isCustom.value = await window.$mapi.file.isDataRootCustom();
};

onMounted(() => {
    doLoad();
    // Screenshot hook (invoked by screenshot name "setting.prepare"):
    // replace real paths with demo paths and hide the custom hint to avoid leaking local paths.
    testActionSet("Setting.setDataRootDemo", (arg?: any) => {
        const home = arg?.home || "/Users/demo";
        const demoDataRoot = `${home}/Library/Application Support/aigcpanel/data`;
        dataRoot.value = demoDataRoot;
        dataRootDefault.value = demoDataRoot;
        isCustom.value = false;
    });
});
onBeforeUnmount(() => {
    testActionUnset("Setting.setDataRootDemo");
});

const doOpen = () => {
    if (dataRoot.value) {
        window.$mapi.app.openPath(dataRoot.value);
    }
};
</script>

<template>
    <a-alert v-if="isCustom" type="warning" show-icon class="mb-4">
        <template #title>{{ t("setting.dataRootCustom") }}</template>
        <div class="text-xs leading-6 break-all">{{ dataRoot }}</div>
        <div class="mt-1 text-xs leading-5 opacity-80">
            {{ t("setting.dataRootCustomDesc") }}
        </div>
        <a-button size="mini" class="mt-2" @click="doOpen">
            <template #icon>
                <icon-folder />
            </template>
            {{ t("common.openPath") }}
        </a-button>
    </a-alert>
</template>

<style scoped></style>
