<script setup lang="ts">
import { computed, ref, watch } from "vue";
import LogViewerDialog from "../common/LogViewerDialog.vue";
import { t } from "../../lang";
import { Dialog } from "../../lib/dialog";
import { useServerStore } from "../../store/modules/server";
import { ServerRecord } from "../../types/Server";

const props = withDefaults(
    defineProps<{
        /** 模型标识 "name|version"，为空时不可用 */
        serverKey?: string;
        /** 展示文案，默认「查看日志」 */
        text?: string;
        /** button：按钮；link：文字链接 */
        variant?: "button" | "link";
    }>(),
    {
        serverKey: "",
        text: "",
        variant: "button",
    },
);

const serverStore = useServerStore();
const logViewer = ref<InstanceType<typeof LogViewerDialog> | null>(null);
const record = ref<ServerRecord | null>(null);

let resolveSeq = 0;
watch(
    () => props.serverKey,
    async (key) => {
        const seq = ++resolveSeq;
        const resolved = key ? await serverStore.getByKey(key) : undefined;
        if (seq !== resolveSeq) {
            return;
        }
        record.value = (resolved as ServerRecord | undefined) || null;
    },
    { immediate: true },
);

const logFile = computed(() => {
    return (record.value?.runtime?.logFile as string) || "";
});

const label = computed(() => props.text || t("log.viewModelLog"));

const doShow = () => {
    if (!props.serverKey) {
        return;
    }
    if (!logFile.value) {
        // Model is selected but has not produced a log yet (e.g. cloud model).
        Dialog.tipError(t("empty.noLogFile"));
        return;
    }
    logViewer.value?.show();
};
</script>

<template>
    <span class="inline-flex items-center flex-shrink-0">
        <a
            v-if="variant === 'link'"
            class="flex-shrink-0 whitespace-nowrap"
            :class="
                !serverKey
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-blue-500'
            "
            href="javascript:;"
            @click="doShow"
        >
            {{ label }}
        </a>
        <a-button v-else :disabled="!serverKey" @click="doShow">
            <template #icon>
                <icon-file />
            </template>
            {{ label }}
        </a-button>
        <LogViewerDialog ref="logViewer" :log-file="logFile" />
    </span>
</template>
