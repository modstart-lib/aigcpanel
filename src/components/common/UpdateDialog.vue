<script setup lang="ts">
import { computed, onMounted } from "vue";
import { t } from "../../lang";
import { updaterStore } from "../../store/modules/updater";

const store = updaterStore();

// Release notes come from the update API as HTML (notes/summary); older data may be plain text.
// Only inject as HTML when it actually contains tags, otherwise keep the plain-text layout.
const notesIsHtml = computed(() => /<\/?[a-z][\s\S]*>/i.test(store.notes || ""));

onMounted(() => {
    store.init();
});

const phaseTitle = () => {
    switch (store.state.phase) {
        case "checking":
            return t("update.checking");
        case "available":
            return t("update.newVersionFound", {
                version: store.latestVersion,
            });
        case "downloading":
            return t("update.downloading");
        case "ready":
            return t("update.downloadComplete");
        case "installing":
        case "restarting":
            return t("update.installing");
        case "up-to-date":
            return t("update.alreadyLatest");
        case "failed":
            return t("update.checkFailed");
        default:
            return t("update.title");
    }
};

const errorText = () => {
    return store.error || store.state.error || "";
};
</script>

<template>
    <a-modal
        v-model:visible="store.visible"
        :title="t('update.title')"
        :footer="false"
        :width="560"
        unmount-on-close
        modal-class="updater-dialog"
    >
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <div>
                    <div class="text-base font-bold text-gray-800">
                        {{ phaseTitle() }}
                    </div>
                    <div class="text-xs text-gray-400 mt-1">
                        {{ t("update.currentVersion") }}
                        v{{ store.state.currentVersion }}
                        <template v-if="store.latestVersion">
                            → v{{ store.latestVersion }}
                        </template>
                    </div>
                </div>
                <a-spin v-if="store.checking" :size="18" />
            </div>

            <a-alert
                v-if="errorText()"
                type="error"
                :show-icon="true"
                class="text-xs"
            >
                {{ errorText() }}
            </a-alert>

            <div
                v-if="
                    store.state.phase === 'available' ||
                    store.state.phase === 'downloading' ||
                    store.state.phase === 'ready'
                "
                class="space-y-3"
            >
                <div
                    v-if="store.feature"
                    class="text-xs text-gray-500 bg-gray-50 rounded-md px-3 py-2"
                >
                    {{ store.feature }}
                </div>

                <div
                    v-if="store.notes"
                    class="updater-notes max-h-40 overflow-y-auto text-xs leading-relaxed text-gray-600 border border-gray-100 rounded-md px-3 py-2"
                >
                    <div v-if="notesIsHtml" v-html="store.notes"></div>
                    <div v-else class="whitespace-pre-wrap">
                        {{ store.notes }}
                    </div>
                </div>

                <div
                    v-if="store.state.asset"
                    class="flex items-center justify-between text-xs text-gray-500 bg-gray-50 rounded-md px-3 py-2"
                >
                    <span class="truncate mr-3">{{
                        store.state.asset.name
                    }}</span>
                    <span class="shrink-0">{{
                        store.state.asset.size > 0
                            ? store.assetSizeText
                            : t("update.sizeUnknown")
                    }}</span>
                </div>

                <a-alert
                    v-if="
                        store.state.phase === 'available' && !store.state.asset
                    "
                    type="warning"
                    :show-icon="true"
                    class="text-xs"
                >
                    {{ t("update.noAsset") }}
                </a-alert>

                <a-alert
                    v-else-if="
                        store.state.phase === 'available' &&
                        !store.canAutoInstall
                    "
                    type="warning"
                    :show-icon="true"
                    class="text-xs"
                >
                    {{ t("update.manualInstallTip") }}
                </a-alert>

                <div v-if="store.isDownloading" class="space-y-1">
                    <div
                        class="h-2 w-full overflow-hidden rounded-full bg-gray-100"
                    >
                        <div
                            class="h-full rounded-full bg-green-500 transition-all duration-300"
                            :style="{ width: store.progressPercent + '%' }"
                        ></div>
                    </div>
                    <div
                        class="flex items-center justify-between text-xs text-gray-400 tabular-nums"
                    >
                        <span>
                            {{ store.downloadedText }} /
                            {{ store.sizeText }}
                            <span v-if="store.speedText">
                                · {{ store.speedText }}
                            </span>
                        </span>
                        <span>{{ store.progressPercent }}%</span>
                    </div>
                    <div
                        v-if="store.state.resumedBytes > 0"
                        class="text-[11px] text-blue-500"
                    >
                        {{
                            t("update.resumeFrom", {
                                size: store.resumedText,
                            })
                        }}
                    </div>
                </div>

                <div
                    v-if="store.hasBlockers"
                    class="border border-orange-200 bg-orange-50 rounded-md px-3 py-2 space-y-2"
                >
                    <div class="text-xs font-bold text-orange-700">
                        {{ t("update.blockedTitle") }}
                    </div>
                    <div
                        v-for="(item, index) in store.state.blockers"
                        :key="index"
                        class="flex items-center justify-between text-xs text-orange-800"
                    >
                        <span class="truncate mr-2">
                            {{ item.name }}
                        </span>
                        <span class="shrink-0 text-orange-500">
                            {{
                                item.type === "server"
                                    ? t("update.blockerServer")
                                    : item.type === "process"
                                      ? t("update.blockerProcess")
                                      : item.type === "task"
                                        ? t("update.blockerTask")
                                        : t("update.blockerApp")
                            }}
                        </span>
                    </div>
                    <div class="text-[11px] text-orange-500">
                        {{
                            store.hasStoppableBlockers
                                ? t("update.blockedTip")
                                : t("update.blockedExternalTip")
                        }}
                    </div>
                </div>
            </div>

            <div class="flex items-center justify-end gap-2 pt-1">
                <a-button
                    v-if="store.updateAvailable && !store.isDownloading"
                    size="small"
                    @click="store.openDownloadPage()"
                >
                    {{ t("update.openDownloadPage") }}
                </a-button>

                <a-button
                    v-if="store.isDownloading"
                    size="small"
                    @click="store.hide()"
                >
                    {{ t("update.downloadInBackground") }}
                </a-button>

                <a-button
                    v-if="store.isDownloading"
                    size="small"
                    @click="store.cancelDownload()"
                >
                    {{ t("update.cancelDownload") }}
                </a-button>

                <a-button
                    v-if="
                        (store.state.phase === 'available' ||
                            store.state.phase === 'failed') &&
                        store.state.asset
                    "
                    type="primary"
                    size="small"
                    :loading="store.probing"
                    @click="store.download()"
                >
                    {{ t("update.downloadUpdate") }}
                </a-button>

                <a-button
                    v-if="store.isReady && store.canAutoInstall"
                    type="primary"
                    size="small"
                    :loading="store.installing"
                    @click="store.restart()"
                >
                    {{ t("update.restartUpdate") }}
                </a-button>

                <a-button
                    v-if="store.isReady && store.hasStoppableBlockers"
                    type="primary"
                    size="small"
                    :loading="store.installing"
                    @click="store.stopBlockersAndRestart()"
                >
                    {{ t("update.stopAndRestart") }}
                </a-button>

                <a-button
                    v-if="store.isReady && store.hasBlockers"
                    size="small"
                    :loading="store.checking"
                    @click="store.preflight()"
                >
                    {{ t("update.checkAgain") }}
                </a-button>

                <a-button
                    v-if="store.isReady"
                    size="small"
                    @click="store.openDownloadedFile()"
                >
                    {{ t("update.openDownloadedFile") }}
                </a-button>

                <a-button
                    v-if="store.state.phase === 'up-to-date'"
                    size="small"
                    :loading="store.checking"
                    @click="store.check(true)"
                >
                    {{ t("update.checkAgain") }}
                </a-button>
            </div>
        </div>
    </a-modal>
</template>

<style scoped lang="less">
.updater-notes {
    :deep(p) {
        margin: 0;
    }

    :deep(p + p) {
        margin-top: 0.25rem;
    }

    :deep(ul),
    :deep(ol) {
        margin: 0;
        padding-left: 1.25rem;
    }

    :deep(img) {
        max-width: 100%;
    }
}
</style>
