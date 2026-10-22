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

const hasRecords = computed(() => {
    let count = recordsFilter.value.length;
    
    return count > 0;
});
const emit = defineEmits({
    update: (config: any) => true,
});
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
        :placeholder="$t('model.select')"
        size="small"
        class="min-w-64"
        style="height: 32px"
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
        <a-optgroup v-if="showCloudOptgroup" :label="$t('model.cloudModel')">
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
                </div>
            </a-option>
        </a-optgroup>
        <a-optgroup
            v-if="!showCloudOptgroup"
            :label="$t('model.upgradeProForCloud')"
        ></a-optgroup>
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
