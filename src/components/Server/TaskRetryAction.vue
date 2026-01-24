<script setup lang="ts">
import { t } from "../../lang";
import { Dialog } from "../../lib/dialog";
import { sleep } from "../../lib/util";
import { TaskRecord, TaskService } from "../../service/TaskService";
import { useTaskStore } from "../../store/modules/task";

const taskStore = useTaskStore();

const props = defineProps<{
    record: TaskRecord;
}>();

const doRetry = async () => {
    const record = props.record;
    Dialog.loadingOn(t("status.retrying"));
    try {
        await sleep(500);
        await TaskService.update(record.id as any, {
            status: 'queue',
            jobResult: {},
            result: {},
        }, { mergeResult: false });
        await taskStore.dispatch(record.biz, record.id as any);
        Dialog.loadingOff();
        Dialog.tipSuccess(t("common.retrySuccess"));
    } catch (e) {
        Dialog.loadingOff();
        Dialog.tipError(t("common.retryFailed"));
    }
};
</script>

<template>
    <a-tooltip v-if="record.status === 'fail'" :content="$t('task.retry')" mini>
        <a-button class="mr-2" @click="doRetry()">
            <template #icon>
                <icon-refresh />
            </template>
        </a-button>
    </a-tooltip>
</template>
