<script setup lang="ts">
import { testActionSet, testActionUnset } from "@/utils/test";
import { onMounted, onUnmounted, ref } from "vue";
import { t } from "../../../lang";
import TaskBatchDeleteAction from "../../../components/Server/TaskBatchDeleteAction.vue";
import TaskBatchDownloadAction from "../../../components/Server/TaskBatchDownloadAction.vue";
import ToggleButton from "../../../components/common/ToggleButton.vue";
import { useCheckAll } from "../../../components/common/check-all";
import { useTaskRecords } from "../../../hooks/taskRecords";
import { TaskService } from "../../../service/TaskService";
import { useTaskStore } from "../../../store/modules/task";
import VideoMarkCreate from "./components/VideoMarkCreate.vue";
import VideoMarkItem from "./components/VideoMarkItem.vue";
import Steps from "../common/Steps.vue";
import ListerTop from "../../../components/common/ListerTop.vue";
import MEmpty from "../../../components/common/MEmpty.vue";
import PageHeader from "../../../components/PageHeader.vue";

const {
    page,
    recordsForPage,
    total,
    reload: doRefresh,
} = useTaskRecords("VideoMark", {});

const { isIndeterminate, isAllChecked, onCheckAll, checkRecords } = useCheckAll(
    {
        records: recordsForPage,
    },
);

const stepsVisible = ref(false);
const taskStore = useTaskStore();

onMounted(async () => {
    await doRefresh();
    
});

onUnmounted(() => {
    
});
</script>

<template>
    <div class="p-5">
        <PageHeader
            :title="$t('app.videoMarkTitle')"
            :desc="$t('app.videoMarkDesc')"
        >
            <template #actions
                ><ToggleButton v-model="stepsVisible"
            /></template>
        </PageHeader>
        <Steps
            v-if="stepsVisible"
            :steps="[
                {
                    key: 1,
                    label: $t('app.stepSelectVideo'),
                    description: $t('app.stepSelectVideoDesc'),
                },
                {
                    key: 2,
                    label: $t('app.stepSetMarkNode'),
                    description: $t('app.stepSetMarkNodeDesc'),
                },
                {
                    key: 3,
                    label: $t('app.stepGenerateVideo'),
                    description: $t('app.stepGenerateVideoDesc'),
                },
            ]"
        />
        <div>
            <VideoMarkCreate @submitted="doRefresh" />
            <ListerTop class="mt-4" :total="total" @refresh="doRefresh">
                <a-checkbox
                    :model-value="isAllChecked"
                    :indeterminate="isIndeterminate"
                    @change="onCheckAll"
                >
                    {{ $t("common.selectAll") }}
                </a-checkbox>
                <TaskBatchDeleteAction
                    :records="checkRecords"
                    @update="doRefresh"
                />
                <TaskBatchDownloadAction :records="checkRecords" />
                <template #actions>
                    <a-pagination
                        v-model:current="page"
                        :total="total"
                        :page-size="10"
                        show-total
                        simple
                    />
                </template>
            </ListerTop>
            <div v-if="total > 0">
                <div v-for="r in recordsForPage" :key="r.id">
                    <VideoMarkItem
                        :record="r"
                        :dialog="false"
                        :on-refresh="doRefresh"
                    />
                </div>
            </div>
            <m-empty v-else />
        </div>
    </div>
</template>
