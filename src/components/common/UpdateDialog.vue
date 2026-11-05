<script setup lang="ts">
import { onMounted } from "vue";
import { t } from "../../lang";
import { updaterStore } from "../../store/modules/updater";

const store = updaterStore();

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

const latencyText = (latency: number, ok: boolean) => {
    if (!ok) {
        return t("update.channelTimeout");
    }
    if (latency >= 1000) {
        return `${(latency / 1000).toFixed(2)} s`;
    }
    return `${latency} ms`;
};

const latencyClass = (latency: number, ok: boolean) => {
    if (!ok) {
        return "text-gray-400";
    }
    if (latency <= 400) {
        return "text-green-600";
    }
    if (latency <= 1200) {
        return "text-orange-500";
    }
    return "text-red-500";
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
                    class="max-h-40 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-gray-600 border border-gray-100 rounded-md px-3 py-2"
                >
                    {{ store.notes }}
                </div>

                <div
                    v-if="store.state.asset"
                    class="flex items-center justify-between text-xs text-gray-500 bg-gray-50 rounded-md px-3 py-2"
                >
                    <span class="truncate mr-3">{{
                        store.state.asset.name
                    }}</span>
                    <span class="shrink-0">{{ store.sizeText }}</span>
                </div>

                <div v-if="store.state.channels.length" class="space-y-1">
                    <div class="text-xs font-bold text-gray-500">
                        {{ t("update.downloadChannel") }}
                        <span
                            v-if="store.probing"
                            class="font-normal text-gray-400"
                        >
                            · {{ t("update.channelProbing") }}
                        </span>
                    </div>
                    <div
                        v-for="item in store.probes"
                        :key="item.url"
                        class="flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer text-xs transition-colors"
                        :class="
                            store.selectedUrl === item.url
                                ? 'bg-blue-50 text-blue-700'
                                : 'hover:bg-gray-50 text-gray-600'
                        "
                        @click="item.ok && store.selectChannel(item.url)"
                    >
                        <div class="flex items-center min-w-0">
                            <span
                                class="inline-block w-3 shrink-0"
                                v-if="store.selectedUrl === item.url"
                            >
                                ✓
                            </span>
                            <span class="truncate">{{ item.title }}</span>
                        </div>
                        <span
                            class="shrink-0 ml-3 tabular-nums"
                            :class="latencyClass(item.latency, item.ok)"
                        >
                            {{ latencyText(item.latency, item.ok) }}
                        </span>
                    </div>
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
                    <a-progress
                        :percent="store.progressPercent"
                        :show-text="false"
                        :stroke-width="8"
                    />
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
                                    : t("update.blockerProcess")
                            }}
                        </span>
                    </div>
                    <div class="text-[11px] text-orange-500">
                        {{ t("update.blockedTip") }}
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
