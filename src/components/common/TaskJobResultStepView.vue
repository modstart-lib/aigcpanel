<script setup lang="ts">
import {TaskJobResultStepStatus, TaskRecord} from "../../service/TaskService";
import {computed} from "vue";

const props = defineProps<{
    record: TaskRecord;
    step: string;
}>();
const stepData = computed(() => {
    return props.record.jobResult?.[props.step] as {
        status: TaskJobResultStepStatus;
    };
});
</script>

<template>
    <div v-if="stepData && stepData.status === 'success'" class="w-full">
        <slot></slot>
        <slot name="successRunning"></slot>
        <slot name="successPending"></slot>
    </div>
    <div v-else-if="stepData && stepData.status === 'pending'" class="w-full">
        <slot></slot>
        <slot name="pending"></slot>
        <slot name="successPending"></slot>
    </div>
    <div
        v-else-if="stepData && stepData.status === 'running' && record.status === 'running'"
        class="w-full bg-gray-100 rounded-lg"
    >
        <div class="text-gray-400 text-xs p-2">
            <icon-refresh spin />
            {{ $t("task.processing") }}
        </div>
        <slot name="running"></slot>
        <slot name="successRunning"></slot>
    </div>
    <div
        v-else-if="stepData && stepData.status === 'running' && record.status === 'fail'"
        class="w-full bg-gray-100 rounded-lg"
    >
        <div class="text-red-400 text-xs p-2">
            <icon-info-circle />
            {{ $t("error.processError") }}
        </div>
    </div>
    <div v-else-if="stepData && stepData.status === 'fail'" class="w-full bg-gray-100 rounded-lg">
        <div class="text-red-400 text-xs p-2">
            <icon-info-circle />
            {{ $t("error.processError") }}
        </div>
    </div>
    <div v-else class="w-full bg-gray-100 rounded-lg">
        <div class="text-gray-400 text-xs p-2">
            <icon-info-circle />
            {{ $t("status.unprocessed") }}
        </div>
    </div>
</template>
