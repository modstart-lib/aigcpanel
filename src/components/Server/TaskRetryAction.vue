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

const emit = defineEmits({
    update: () => true,
});

const doRetry = async () => {
    const record = props.record;
    Dialog.loadingOn(t("status.retrying"));
    try {
        await sleep(500);
        // 多步骤任务：jobResult 中存在 step 状态机，保留已成功步骤，
        // 仅置 queue 后重新调度，从失败步骤继续执行
        const isMultiStep = !!record.jobResult?.step;
        if (isMultiStep) {
            await TaskService.update(record.id as any, {
                status: "queue",
                statusMsg: "",
            });
        } else {
            // 非多步骤任务：清空 jobResult / result，整体重新运行
            await TaskService.update(
                record.id as any,
                {
                    status: "queue",
                    statusMsg: "",
                    jobResult: {},
                    result: {},
                },
                { mergeResult: false },
            );
        }
        await taskStore.dispatch(record.biz, record.id as any);
        Dialog.loadingOff();
        Dialog.tipSuccess(t("common.retrySuccess"));
    } catch (e) {
        Dialog.loadingOff();
        Dialog.tipError(t("common.retryFailed"));
    }
    emit("update");
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
