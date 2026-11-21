<script setup lang="ts">
import { onMounted, ref } from "vue";
import ServerNameVersion from "../../../components/Server/ServerNameVersion.vue";
import TaskBatchDeleteAction from "../../../components/Server/TaskBatchDeleteAction.vue";
import TaskBatchDownloadAction from "../../../components/Server/TaskBatchDownloadAction.vue";
import TaskCancelAction from "../../../components/Server/TaskCancelAction.vue";
import TaskDeleteAction from "../../../components/Server/TaskDeleteAction.vue";
import TaskDownloadAction from "../../../components/Server/TaskDownloadAction.vue";
import TaskDuration from "../../../components/Server/TaskDuration.vue";
import TaskTitleField from "../../../components/Server/TaskTitleField.vue";
import TextTruncateView from "../../../components/TextTruncateView.vue";
import AudioPlayer from "../../../components/common/AudioPlayer.vue";
import TaskBizStatus from "../../../components/common/TaskBizStatus.vue";
import VideoPlayer from "../../../components/common/VideoPlayer.vue";
import { useCheckAll } from "../../../components/common/check-all";
import { usePaginate } from "../../../hooks/paginate";
import { useTaskChangeRefresh } from "../../../hooks/task";
import { TaskRecord, TaskService } from "../../../service/TaskService";
import SoundGenerateFormViewBody from "../../Video/components/SoundGenerateFormViewBody.vue";
import VideoGenFormViewBody from "../../Video/components/VideoGenFormViewBody.vue";
import VideoGenFlowCreate from "./components/VideoGenFlowCreate.vue";
import ListerTop from "../../../components/common/ListerTop.vue";
import MEmpty from "../../../components/common/MEmpty.vue";
import PageHeader from "../../../components/PageHeader.vue";

const videoGenFlowCreate = ref<InstanceType<typeof VideoGenFlowCreate> | null>(
    null,
);

const { page, records, recordsForPage } = usePaginate<TaskRecord>();

const { mergeCheck, isIndeterminate, isAllChecked, onCheckAll, checkRecords } =
    useCheckAll({
        records: recordsForPage,
    });

useTaskChangeRefresh("VideoGenFlow", () => {
    setTimeout(doRefresh, 1000);
});

const doRefresh = async () => {
    records.value = mergeCheck(await TaskService.list("VideoGenFlow"));
};

onMounted(() => {
    doRefresh();
});
</script>

<template>
    <div class="p-5">
        <PageHeader
            :title="$t('app.videoGen')"
            :desc="$t('app.videoGenDesc')"
        />
        <div>
            <VideoGenFlowCreate
                ref="videoGenFlowCreate"
                @submitted="doRefresh"
            />
            <ListerTop
                class="mt-4"
                :total="records.length"
                @refresh="doRefresh"
            >
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
                        :total="records.length"
                        :page-size="10"
                        show-total
                        simple
                    />
                </template>
            </ListerTop>
            <div v-if="records.length > 0">
                <div v-for="r in recordsForPage" :key="r.id">
                    <div
                        class="rounded-xl shadow border p-4 mt-4 hover:shadow-lg"
                    >
                        <div class="flex items-center gap-1">
                            <div
                                class="inline-flex items-center bg-blue-100 rounded-full px-2 leading-8 h-8 mr-2"
                            >
                                <div class="mr-2 h-8 pt-0.5">
                                    <a-checkbox v-model="r['_check']" />
                                </div>
                                <div class="">
                                    <TaskTitleField
                                        :record="r"
                                        @title-click="
                                            r['_check'] = !r['_check']
                                        "
                                        @update="(v) => (r.title = v)"
                                    />
                                </div>
                            </div>
                            <div class="flex-grow"></div>
                            <TaskDuration
                                :start="r.startTime"
                                :end="r.endTime"
                            />
                            <TaskBizStatus
                                :status="r.status"
                                :status-msg="r.statusMsg"
                            />
                        </div>
                        <div class="mt-3 flex gap-1 flex-wrap">
                            <ServerNameVersion :record="r" />
                            <VideoGenFormViewBody :data="r.modelConfig" />
                        </div>
                        <div
                            class="mt-3 flex gap-1 flex-wrap"
                            v-if="r.modelConfig.soundGenerate"
                        >
                            <SoundGenerateFormViewBody
                                :data="r.modelConfig.soundGenerate"
                            />
                        </div>
                        <div class="pt-4 flex">
                            <div class="flex-grow">
                                <div class="bg-gray-100 rounded-lg p-2 mb-3">
                                    <TextTruncateView
                                        :text="r.modelConfig.text"
                                    />
                                </div>
                                <!-- The sound is generated before the video, so show it as
                                     soon as it exists: if the video step fails the sound
                                     is still a valid result the user can keep. -->
                                <div
                                    v-if="r.result && r.result.urlSound"
                                    class="flex items-center gap-2"
                                >
                                    <div class="flex-grow min-w-0">
                                        <AudioPlayer
                                            show-wave
                                            :url="'file://' + r.result.urlSound"
                                        />
                                    </div>
                                    <TaskDownloadAction
                                        :record="r"
                                        name="urlSound"
                                        :title="$t('download.audio')"
                                        allow-partial
                                    />
                                </div>
                            </div>
                            <div class="flex-shrink-0 ml-8">
                                <div
                                    class="p-2 rounded shadow bg-gray-300"
                                    v-if="
                                        r.status === 'success' && r.result.url
                                    "
                                >
                                    <div class="w-48 h-48" v-if="r.result.url">
                                        <VideoPlayer
                                            :url="'file://' + r.result.url"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="pt-4 flex items-center">
                            <div class="text-gray-400 flex-grow">
                                <timeago :datetime="r['createdAt'] * 1000" />
                            </div>
                            <div class="">
                                <TaskDownloadAction :record="r" />
                                <TaskDeleteAction
                                    :record="r"
                                    @update="doRefresh"
                                />
                                <TaskCancelAction :record="r" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <m-empty v-else />
        </div>
    </div>
</template>
