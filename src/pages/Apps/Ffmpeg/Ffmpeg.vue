<script setup lang="ts">
import { ref } from "vue";
import { t } from "../../../lang";
import TaskBatchDeleteAction from "../../../components/Server/TaskBatchDeleteAction.vue";
import TaskBatchDownloadAction from "../../../components/Server/TaskBatchDownloadAction.vue";
import ToggleButton from "../../../components/common/ToggleButton.vue";
import { useCheckAll } from "../../../components/common/check-all";
import { useTaskRecords } from "../../../hooks/taskRecords";
import Steps from "../common/Steps.vue";
import FfmpegCreate from "./components/FfmpegCreate.vue";
import FfmpegItem from "./components/FfmpegItem.vue";
import ListerTop from "../../../components/common/ListerTop.vue";
import MEmpty from "../../../components/common/MEmpty.vue";
import PageHeader from "../../../components/PageHeader.vue";

const {
    page,
    recordsForPage,
    total,
    reload: doRefresh,
} = useTaskRecords("Ffmpeg", {});

const { isIndeterminate, isAllChecked, onCheckAll, checkRecords } = useCheckAll(
    {
        records: recordsForPage,
    },
);

const stepsVisible = ref(false);
</script>

<template>
    <div class="p-5">
        <PageHeader :title="t('app.ffmpegTitle')" :desc="t('app.ffmpegDesc')">
            <template #actions
                ><ToggleButton v-model="stepsVisible"
            /></template>
        </PageHeader>
        <Steps
            v-if="stepsVisible"
            :steps="[
                {
                    key: 1,
                    label: t('app.stepInputFile'),
                    description: t('app.stepInputFileDesc'),
                },
                {
                    key: 2,
                    label: t('app.stepWriteCommand'),
                    description: t('app.stepWriteCommandDesc'),
                },
                {
                    key: 3,
                    label: t('app.stepExecute'),
                    description: t('app.stepExecuteDesc'),
                },
            ]"
        />
        <div>
            <FfmpegCreate @submitted="doRefresh" />
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
                    <FfmpegItem
                        :record="r"
                        :dialog="false"
                        :on-refresh="doRefresh"
                    />
                </div>
            </div>
            <m-empty v-else />
            <div>
                <FfmpegCreate @submitted="doRefresh" />
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
                        <FfmpegItem
                            :record="r"
                            :dialog="false"
                            :on-refresh="doRefresh"
                        />
                    </div>
                </div>
                <m-empty v-else />
            </div>
        </div>
    </div>
</template>
