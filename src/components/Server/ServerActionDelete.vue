<script setup lang="ts">
import {EnumServerStatus, EnumServerType, ServerRecord} from "../../types/Server";
import {Dialog} from "../../lib/dialog";
import {t} from "../../lang";
import {sleep} from "../../lib/util";
import {useServerStore} from "../../store/modules/server";
import {computed} from "vue";

const serverStore = useServerStore();

const props = defineProps<{
    record: ServerRecord;
}>();
const emit = defineEmits({
    update: () => true,
});

const doDelete = async () => {
    const record = props.record;
    await Dialog.confirm(t("model.deleteConfirm", {title: record.title, version: record.version}));
    Dialog.loadingOn(t("status.deleting"));
    await sleep(500);
    await serverStore.delete(record);
    Dialog.loadingOff();
    emit("update");
};

const disabled = computed(() => {
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
    <a-tooltip :content="$t('common.delete')" mini>
        <a-button class="mr-2" :disabled="disabled" @click="doDelete()">
            <template #icon>
                <icon-delete />
            </template>
        </a-button>
    </a-tooltip>
</template>
