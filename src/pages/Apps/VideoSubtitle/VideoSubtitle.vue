<script setup lang="ts">
import { ref } from "vue";
import { t } from "../../../lang";
import TaskBatchDeleteAction from "../../../components/Server/TaskBatchDeleteAction.vue";
import TaskBatchDownloadAction from "../../../components/Server/TaskBatchDownloadAction.vue";
import ToggleButton from "../../../components/common/ToggleButton.vue";
import { useCheckAll } from "../../../components/common/check-all";
import { useTaskRecords } from "../../../hooks/taskRecords";
import VideoSubtitleCreate from "./components/VideoSubtitleCreate.vue";
import VideoSubtitleItem from "./components/VideoSubtitleItem.vue";
import Steps from "../common/Steps.vue";
import ListerTop from "../../../components/common/ListerTop.vue";
import MEmpty from "../../../components/common/MEmpty.vue";
import PageHeader from "../../../components/PageHeader.vue";

const {
    page,
    recordsForPage,
    total,
    reload: doRefresh,
} = useTaskRecords("VideoSubtitle", {});

const { isIndeterminate, isAllChecked, onCheckAll, checkRecords } = useCheckAll(
    {
        records: recordsForPage,
    },
);

const stepsVisible = ref(false);
</script>

<template>
    <div class="p-5">
        <PageHeader
            :title="t('app.videoSubtitleTitle')"
            :desc="t('app.videoSubtitleDesc')"
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
                    label: t('app.videoSubtitleStepSelectFile'),
                    description: t('app.videoSubtitleStepSelectFileDesc'),
                },
                {
                    key: 2,
                    label: t('app.videoSubtitleStepParseContent'),
                    description: t('app.videoSubtitleStepParseContentDesc'),
                },
                {
                    key: 3,
                    label: t('app.videoSubtitleStepCompositeVideo'),
                    description: t('app.videoSubtitleStepCompositeVideoDesc'),
                },
            ]"
        />
        <div>
            <VideoSubtitleCreate @submitted="doRefresh" />
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
                    <VideoSubtitleItem
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
