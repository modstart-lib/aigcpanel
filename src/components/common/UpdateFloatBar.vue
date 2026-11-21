<script setup lang="ts">
import { t } from "../../lang";
import { updaterStore } from "../../store/modules/updater";

const store = updaterStore();

const restart = async () => {
    await store.restart();
    if (store.hasBlockers) {
        store.show();
    }
};
</script>

<template>
    <div
        v-if="
            !store.visible &&
            (store.isDownloading ||
                store.isReady ||
                ['installing', 'restarting'].includes(store.state.phase))
        "
        class="fixed right-4 bottom-4 z-[2000] w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-lg"
    >
        <div class="flex items-center justify-between">
            <div class="text-sm font-bold text-gray-800">
                {{
                    store.isDownloading
                        ? t("update.downloading")
                        : store.isReady
                          ? t("update.downloadComplete")
                          : t("update.installing")
                }}
            </div>
            <a-button size="mini" @click="store.show()">
                {{ t("update.viewUpdate") }}
            </a-button>
        </div>
        <div v-if="store.isDownloading" class="mt-2">
            <div class="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                    class="h-full rounded-full bg-green-500 transition-all duration-300"
                    :style="{ width: store.progressPercent + '%' }"
                ></div>
            </div>
            <div class="mt-1 text-[11px] text-gray-400 tabular-nums">
                {{ store.downloadedText }} / {{ store.sizeText }} ·
                {{ store.progressPercent }}%
            </div>
        </div>
        <div v-if="store.isReady" class="mt-2 flex justify-end">
            <a-button
                type="primary"
                size="mini"
                :loading="store.installing"
                @click="restart"
            >
                {{ t("update.restartUpdate") }}
            </a-button>
        </div>
    </div>
</template>
