<script setup lang="ts">
import {Dialog} from "../../lib/dialog";
import {t} from "../../lang";
import {sleep} from "../../lib/util";
import {TaskRecord} from "../../service/TaskService";
import {computed} from "vue";
import {useTaskStore} from "../../store/modules/task";

const taskStore = useTaskStore();

const props = defineProps<{
    record: TaskRecord;
}>();

const doCancel = async () => {
    const record = props.record;
    Dialog.loadingOn(t("status.cancelling"));
    try {
        taskStore.requestCancel(record.biz, record.id as any);
        await sleep(500);
        Dialog.loadingOff();
        Dialog.tipSuccess(t("msg.stopRequested"));
    } catch (e) {
        Dialog.loadingOff();
        Dialog.tipError(t("error.cancelTaskFailed"));
    }
};
const isCloud = computed(() => {
    return props.record.serverName.startsWith("Cloud");
});
</script>

<template>
    <a-tooltip v-if="!isCloud && record.status === 'running'" :content="$t('task.cancel')" mini>
        <a-button class="mr-2" type="primary" status="danger" @click="doCancel()">
            <template #icon>
                <icon-record-stop/>
            </template>
        </a-button>
    </a-tooltip>
</template>
