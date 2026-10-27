<script setup lang="ts">
import { computed } from "vue";
import { Message } from "@arco-design/web-vue";
import { t } from "../../lang";
import { Dialog } from "../../lib/dialog";
import { OfflineAuth } from "../../lib/offlineAuth";
import { sleep } from "../../lib/util";
import { useServerStore } from "../../store/modules/server";
import {
    EnumServerStatus,
    EnumServerType,
    ServerRecord,
} from "../../types/Server";

const serverStore = useServerStore();

const props = defineProps<{
    record: ServerRecord;
}>();
const emit = defineEmits({
    update: () => true,
});

const doDelete = async () => {
    const record = props.record;
    await Dialog.confirm(
        t("model.deleteConfirm", {
            title: record.title,
            version: record.version,
        }),
    );
    Dialog.loadingOn(t("status.deleting"));
    await sleep(500);
    try {
        await serverStore.delete(record);
    } catch (e: any) {
        Dialog.loadingOff();
        const msg = String(e?.message || e);
        Dialog.tipError(
            msg === "PreparingStatusError"
                ? t("error.serverPreparingDelete")
                : msg,
        );
        return;
    }
    Dialog.loadingOff();
    emit("update");
};

// 本地模型支持离线授权：已有授权时也可打开修改
const canOfflineAuth = computed(() => {
    const record = props.record;
    return (
        !!record.localPath &&
        record.type !== EnumServerType.CLOUD &&
        record.type !== EnumServerType.API
    );
});

const doOfflineAuth = async () => {
    const serverInfo = await serverStore.serverInfo(props.record);
    let token = "";
    let machineId = "";
    try {
        const info: any = await $mapi.server.offlineAuthInfo(serverInfo);
        token = (info && info.data && info.data.token) || "";
        machineId = (info && info.data && info.data.machineId) || "";
    } catch (e) {
        // 读取失败按未授权处理
    }
    const value = await OfflineAuth.require({
        packageName: props.record.name,
        machineId: machineId,
        token: token,
        serverInfo: serverInfo,
    });
    if (!value) {
        return;
    }
    const res: any = await $mapi.server.saveOfflineAuth(serverInfo, value);
    if (res && res.code) {
        Dialog.tipError(
            res.msg === "OfflineAuthInvalidToken"
                ? t("offlineAuth.invalidToken")
                : res.msg || t("offlineAuth.saveFailed"),
        );
        return;
    }
    Message.success(t("offlineAuth.savedShort"));
};

const disabled = computed(() => {
    // 权重下载中禁止删除（autoStart 模型 record.status 恒为 RUNNING，需看 runtime 状态）
    if (props.record.runtime?.status === EnumServerStatus.PREPARING) {
        return true;
    }
    if (props.record.autoStart) {
        return false;
    }
    return (
        props.record.type === EnumServerType.LOCAL_DIR &&
        props.record.status !== EnumServerStatus.STOPPED &&
        props.record.status !== EnumServerStatus.ERROR
    );
});
</script>

<template>
    <a-dropdown trigger="click">
        <a-tooltip :content="$t('common.more')" mini>
            <a-button type="text">
                <template #icon>
                    <icon-more />
                </template>
            </a-button>
        </a-tooltip>
        <template #content>
            <a-doption
                v-if="canOfflineAuth"
                @click="doOfflineAuth"
            >
                <template #icon>
                    <icon-safe />
                </template>
                {{ $t("offlineAuth.menu") }}
            </a-doption>
            <a-doption :disabled="disabled" @click="doDelete">
                <template #icon>
                    <icon-delete />
                </template>
                {{ $t("common.delete") }}
            </a-doption>
        </template>
    </a-dropdown>
</template>
