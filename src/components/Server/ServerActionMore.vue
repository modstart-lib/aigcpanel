<script setup lang="ts">
import { computed } from "vue";
import { t } from "../../lang";
import { Dialog } from "../../lib/dialog";
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
            <a-doption :disabled="disabled" @click="doDelete">
                <template #icon>
                    <icon-delete />
                </template>
                {{ $t("common.delete") }}
            </a-doption>
        </template>
    </a-dropdown>
</template>
