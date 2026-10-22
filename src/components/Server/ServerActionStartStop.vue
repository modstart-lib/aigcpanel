<script setup lang="ts">
import { useServerStore } from "../../store/modules/server";
import { EnumServerStatus, ServerRecord } from "../../types/Server";
import { computed } from "vue";
import { t } from "../../lang";

const serverStore = useServerStore();

const props = defineProps<{
    record: ServerRecord;
}>();

// 权重按需下载（config.json 含 prepare）：未就绪时按钮语义为「下载 / 继续 / 重试下载」
const isPrepareModel = computed(() => !!props.record.config?.prepare);
const notReady = computed(
    () => isPrepareModel.value && props.record.runtime?.prepareReady === false,
);
const runtimeStatus = computed(() => props.record.runtime?.status);
const isPreparing = computed(
    () => runtimeStatus.value === EnumServerStatus.PREPARING,
);
const isPaused = computed(
    () => runtimeStatus.value === EnumServerStatus.PAUSED,
);
const isPrepareError = computed(
    () => notReady.value && runtimeStatus.value === EnumServerStatus.ERROR,
);

// 普通服务（已就绪）的启动 / 停止按钮
const showPlay = computed(
    () =>
        props.record.status === EnumServerStatus.STOPPED ||
        props.record.status === EnumServerStatus.STARTING ||
        props.record.status === EnumServerStatus.ERROR,
);
const showPause = computed(
    () =>
        props.record.status === EnumServerStatus.RUNNING ||
        props.record.status === EnumServerStatus.STOPPING,
);

const prepareActionText = computed(() => {
    if (isPaused.value) {
        return t("service.resumeDownload");
    }
    if (isPrepareError.value) {
        return t("service.retryDownload");
    }
    return t("service.downloadWeights");
});

const doPlay = async () => {
    const record = props.record;
    if (notReady.value) {
        await serverStore.prepare(record);
        return;
    }
    await serverStore.start(record);
};
const doStop = async () => {
    const record = props.record;
    await serverStore.stop(record);
};
const doPausePrepare = async () => {
    const record = props.record;
    await serverStore.pausePrepare(record);
};
</script>

<template>
    <!-- 权重下载：文字按钮（下载 / 暂停 / 继续 / 重试） -->
    <template v-if="notReady">
        <a-button
            v-if="isPreparing"
            class="mr-2"
            size="small"
            type="secondary"
            @click="doPausePrepare()"
        >
            {{ $t("service.pauseDownload") }}
        </a-button>
        <a-button
            v-else
            class="mr-2"
            size="small"
            type="primary"
            status="success"
            @click="doPlay()"
        >
            {{ prepareActionText }}
        </a-button>
    </template>
    <!-- 普通服务：图标按钮 -->
    <template v-else>
        <a-tooltip :content="$t('service.start')" mini>
            <a-button
                class="mr-2"
                v-if="showPlay"
                :loading="record.status === EnumServerStatus.STARTING"
                type="primary"
                status="success"
                @click="doPlay()"
            >
                <template #icon>
                    <icon-play-arrow />
                </template>
            </a-button>
        </a-tooltip>
        <a-tooltip :content="$t('common.stopService')" mini>
            <a-button
                class="mr-2"
                v-if="showPause"
                :loading="record.status === EnumServerStatus.STOPPING"
                type="primary"
                status="danger"
                @click="doStop()"
            >
                <template #icon>
                    <icon-pause />
                </template>
            </a-button>
        </a-tooltip>
    </template>
</template>
