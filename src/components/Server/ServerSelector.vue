<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useServerStore } from "../../store/modules/server";
import { EnumServerStatus } from "../../types/Server";

import { Dialog } from "../../lib/dialog";
import { mapError } from "../../lib/error";

const serverStore = useServerStore();


const select = ref<any>(null);
// 权重未就绪的模型在下拉中置灰且不可选中
const availability = (server: any) => serverStore.serverAvailability(server);
const dotClass = (server: any) => {
    if (!availability(server).available) {
        return "bg-gray-400";
    }
    if (
        server.autoStart &&
        server.runtime?.autoStartStatus === EnumServerStatus.RUNNING
    ) {
        return "bg-green-500";
    }
    if (
        server.autoStart &&
        server.runtime?.autoStartStatus !== EnumServerStatus.RUNNING
    ) {
        return "bg-blue-500";
    }
    if (server.status === EnumServerStatus.RUNNING) {
        return "bg-blue-500 animate-pulse";
    }
    return "bg-red-700";
};
const props = defineProps<{
    functionName: string;
}>();
const recordsFilter = computed(() => {
    return serverStore.records.filter((s) =>
        s.functions.includes(props.functionName),
    );
});

const valueAutoStart = computed(() => {
    const server = serverStore.records.find(
        (s) => s.key === select.value?.modelValue,
    );
    return server?.autoStart;
});
const valueAutoStartStatus = computed(() => {
    const server = serverStore.records.find(
        (s) => s.key === select.value?.modelValue,
    );
    return server?.runtime.autoStartStatus || EnumServerStatus.STOPPED;
});
const valueStatus = computed(() => {
    
    return (
        serverStore.records.find((s) => s.key === select.value.modelValue)
            ?.status || EnumServerStatus.STOPPED
    );
});
let showCloudOptgroup = false;

// Cloud catalog state: an empty group must say why it is empty instead of
// vanishing, otherwise users read it as "nothing here, I have to add it".
const cloudLoading = computed(() => {
    
    return false;
});
const cloudLoadFailed = computed(() => {
    
    return false;
});
const doCloudRetry = async () => {
    
};
// Opening the dropdown is the moment the user looks for cloud models: retry
// a failed catalog first so they do not have to reload the whole app.
const onPopupVisibleChange = (visible: boolean) => {
    
};
const hasRecords = computed(() => {
    let count = recordsFilter.value.length;
    
    return count > 0;
});
const emit = defineEmits({
    update: (config: any) => true,
    needModel: () => true,
});
// The dropdown is the only place the user looks for a model, so an empty list
// must offer a way out instead of ending at a disabled row. Weights that are
// not ready count as unusable too: those models can be seen but not selected.
const popupVisible = ref(false);
const availableLocalCount = computed(
    () => recordsFilter.value.filter((s) => availability(s).available).length,
);
const showModelEntry = computed(() => {
    let cloudCount = 0;
    
    // Not gated on the cloud catalog being loaded: the local list is known
    // immediately, and the only way out must not wait on a network request.
    return availableLocalCount.value === 0 && cloudCount === 0;
});
// One conditional slot only: Arco renders the footer wrapper whenever the slot
// exists, so an always-present slot would draw an empty bordered strip.
const footerMode = computed(() => {
    if (showModelEntry.value) {
        return "entry";
    }
    if (cloudLoadFailed.value) {
        return "retry";
    }
    return "";
});
const doNeedModel = () => {
    popupVisible.value = false;
    emit("needModel");
};
watch(
    () => select.value?.modelValue,
    async (value) => {
        if (!value) {
            return;
        }
        let config: any = null;
        
        if (!config) {
            const server = await serverStore.getByKey(value);
            if (server) {
                const res = await window.$mapi.server.config(
                    await serverStore.serverInfo(server),
                );
                if (res.code) {
                    Dialog.tipError(mapError(res.msg));
                    return;
                }
                config = res.data;
            }
        }
        if (!config) {
            return;
        }
        emit("update", config);
    },
);
</script>

<template>
    <a-select
        ref="select"
        v-model:popup-visible="popupVisible"
        :placeholder="$t('model.select')"
        size="small"
        class="min-w-64"
        style="height: 32px"
        @popup-visible-change="onPopupVisibleChange"
    >
        <a-optgroup :label="$t('model.localModel')">
            <a-option
                v-for="server in recordsFilter"
                :key="server.key"
                :value="server.key"
                :disabled="!availability(server).available"
            >
                <div
                    class="flex items-center py-2 flex-nowrap truncate no-wrap"
                >
                    <div
                        class="w-2 h-2 rounded-full mr-1 flex-shrink-0"
                        :class="dotClass(server)"
                    ></div>
                    <div
                        class="text-xs flex-grow"
                        :class="
                            availability(server).available
                                ? ''
                                : 'text-gray-400'
                        "
                    >
                        {{ server.title }}
                        v{{ server.version }}
                    </div>
                    <div
                        v-if="!availability(server).available"
                        class="text-xs text-gray-400 ml-2 flex-shrink-0"
                    >
                        {{ availability(server).reason }}
                    </div>
                </div>
            </a-option>
            <a-option v-if="recordsFilter.length === 0" disabled>
                <div class="text-xs py-2">
                    {{ $t("empty.noLocalModel") }}
                </div>
            </a-option>
        </a-optgroup>
        <a-optgroup
            v-if="showCloudOptgroup"
            :label="$t('model.cloudGroupHint')"
        >
            <a-option
                v-for="server in cloudRecordsFilter"
                :key="server.key"
                :value="server.key"
            >
                <div
                    class="flex items-center py-2 flex-nowrap truncate no-wrap"
                >
                    <div
                        class="w-2 h-2 bg-green-500 rounded-full mr-1 flex-shrink-0"
                    ></div>
                    <div class="text-xs flex-grow">
                        {{ server.title }}
                    </div>
                    <span
                        class="ml-2 flex-shrink-0 rounded bg-green-50 px-1 text-[10px] leading-4 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                    >
                        {{ $t("model.cloudFreeTag") }}
                    </span>
                </div>
            </a-option>
            <a-option
                v-if="!cloudRecordsFilter.length"
                value="__cloud_placeholder__"
                disabled
            >
                <div class="text-xs py-2 text-gray-400">
                    {{
                        cloudLoading
                            ? $t("model.cloudLoading")
                            : cloudLoadFailed
                              ? $t("model.cloudLoadFailed")
                              : $t("model.cloudEmpty")
                    }}
                </div>
            </a-option>
        </a-optgroup>
        <a-optgroup
            v-if="!showCloudOptgroup"
            :label="$t('model.upgradeProForCloud')"
        ></a-optgroup>
        <template v-if="footerMode" #footer>
            <div v-if="footerMode === 'entry'" class="py-1">
                <a-button
                    type="text"
                    long
                    class="!h-9 !justify-start !px-3 !text-sm !text-[var(--color-primary)]"
                    @click="doNeedModel"
                >
                    <template #icon>
                        <icon-plus />
                    </template>
                    {{ $t("model.selectorEntry") }}
                </a-button>
                <!-- Cloud catalog failing must not hide the local way out -->
                <div
                    v-if="cloudLoadFailed"
                    class="px-3 pb-1 text-xs text-gray-400 cursor-pointer hover:text-gray-600"
                    @click="doCloudRetry"
                >
                    <icon-refresh class="mr-1" />
                    {{ $t("model.cloudRetry") }}
                </div>
            </div>
            <div
                v-else
                class="cursor-pointer px-3 py-2 text-xs text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                @click="doCloudRetry"
            >
                <icon-refresh class="mr-1" />
                {{ $t("model.cloudRetry") }}
            </div>
        </template>
        <template #label="{ data }">
            <div class="text-sm flex items-center flex-nowrap truncate no-wrap">
                <div
                    v-if="
                        valueAutoStart &&
                        valueAutoStartStatus === EnumServerStatus.RUNNING
                    "
                    class="w-2 h-2 bg-green-500 rounded-full mr-1 flex-shrink-0"
                ></div>
                <div
                    v-else-if="
                        valueAutoStart &&
                        valueAutoStartStatus !== EnumServerStatus.RUNNING
                    "
                    class="w-2 h-2 bg-blue-500 rounded-full mr-1 flex-shrink-0"
                ></div>
                <div
                    v-else-if="valueStatus === EnumServerStatus.RUNNING"
                    class="w-2 h-2 bg-green-500 rounded-full mr-1 flex-shrink-0"
                ></div>
                <div
                    v-else
                    class="w-2 h-2 bg-red-700 rounded-full mr-1 flex-shrink-0"
                ></div>
                <div v-if="hasRecords">
                    {{ data?.label }}
                </div>
                <div v-else>
                    {{ $t("empty.noModel") }}
                </div>
            </div>
        </template>
    </a-select>
</template>
