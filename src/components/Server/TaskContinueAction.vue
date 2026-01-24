<script setup lang="ts">
import {t} from "../../lang";
import {Dialog} from "../../lib/dialog";
import {sleep} from "../../lib/util";
import {TaskRecord} from "../../service/TaskService";
import {useTaskStore} from "../../store/modules/task";
import {computed} from "vue";

const taskStore = useTaskStore();

const props = defineProps<{
    record: TaskRecord;
}>();

const doContinue = async () => {
    const record = props.record;
    Dialog.loadingOn(t("status.resuming"));
    try {
        await sleep(500);
        await taskStore.dispatch(record.biz, record.id as any);
        Dialog.loadingOff();
        Dialog.tipSuccess(t("common.resumeSuccess"));
    } catch (e) {
        Dialog.loadingOff();
        Dialog.tipError(t("error.resumeFailed"));
    }
};
const continueContent = computed(() => {
    if (props.record.status === "fail") {
        return t("common.retryAttempt");
    }
    return t("task.resume");
});
</script>

<template>
    <a-tooltip v-if="record.status === 'pause' || record.status === 'fail'" :content="continueContent" mini>
        <a-button class="mr-2" @click="doContinue()">
            <template #icon>
                <icon-right-circle />
            </template>
        </a-button>
    </a-tooltip>
</template>
