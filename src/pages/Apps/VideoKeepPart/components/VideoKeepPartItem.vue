<script setup lang="ts">
import { ref } from "vue";
import TaskCancelAction from "../../../../components/Server/TaskCancelAction.vue";
import TaskContinueAction from "../../../../components/Server/TaskContinueAction.vue";
import TaskRetryAction from "../../../../components/Server/TaskRetryAction.vue";
import TaskDeleteAction from "../../../../components/Server/TaskDeleteAction.vue";
import TaskDownloadAction from "../../../../components/Server/TaskDownloadAction.vue";
import TaskDuration from "../../../../components/Server/TaskDuration.vue";
import TaskTitleField from "../../../../components/Server/TaskTitleField.vue";
import TaskBizStatus from "../../../../components/common/TaskBizStatus.vue";
import TaskJobResultStepView from "../../../../components/common/TaskJobResultStepView.vue";
import { TimeUtil } from "../../../../lib/util";
import VideoEditorTimeRangeListSelectorDialog, {
    VideoEditorTimeRangeRecord,
} from "../../../../module/VideoEditor/VideoEditorTimeRangeListSelectorDialog.vue";
import { TaskRecord, TaskService } from "../../../../service/TaskService";
import { useTaskStore } from "../../../../store/modules/task";
import VideoInfo from "../../common/VideoInfo.vue";
import {
    VideoKeepPartJobResultType,
    VideoKeepPartModelConfigType,
} from "../type";
import VideoKeepPartParamView from "./VideoKeepPartParamView.vue";
import VideoPreviewBox from "../../../../components/common/VideoPreviewBox.vue";

const taskStore = useTaskStore();
const props = defineProps<{
    record: TaskRecord<
        VideoKeepPartModelConfigType,
        VideoKeepPartJobResultType
    >;
    dialog: boolean;
    onRefresh: () => void;
}>();

const videoEditorTimeRangeListSelectorDialog = ref<InstanceType<
    typeof VideoEditorTimeRangeListSelectorDialog
> | null>(null);

const onSave = async (times: VideoEditorTimeRangeRecord[]) => {
    console.log("onSave", JSON.stringify(times, null, 2));
    await TaskService.update(props.record.id!, {
        jobResult: {
            step: "Render",
            Config: {
                times,
            },
        },
    });
    await taskStore.dispatch("VideoKeepPart", props.record.id! + "");
    props.onRefresh();
};

const doTimeSelectorShow = () => {
    videoEditorTimeRangeListSelectorDialog.value?.show(
        props.record.modelConfig?.video || "",
        props.record.jobResult?.Config?.times || [],
    );
};
</script>

<template>
    <div class="rounded-xl shadow border p-4 mb-4 hover:shadow-lg">
        <div class="flex items-center gap-1">
            <div
                class="inline-flex items-start bg-blue-100 rounded-full px-2 leading-8 h-8 mr-2"
            >
                <div v-if="!dialog" class="mr-2 h-8 pt-0.5">
                    <a-checkbox v-model="record['_check']" />
                </div>
                <div class="">
                    <TaskTitleField
                        :record="record"
                        :disabled="dialog"
                        @title-click="record['_check'] = !record['_check']"
                        @update="(v) => (record.title = v)"
                    />
                </div>
            </div>
            <div class="flex-grow"></div>
            <TaskDuration :start="record.startTime" :end="record.endTime" />
            <TaskBizStatus
                :status="record.status"
                :status-msg="record.statusMsg"
            />
        </div>
        <div class="mt-3 flex">
            <div class="w-24 flex-shrink-0">
                <div class="inline-block text-center">
                    <icon-sound />
                    {{ $t("app.analyzeVideo") }}
                </div>
            </div>
            <div class="flex-grow pt-1">
                <TaskJobResultStepView :record="record" step="Prepare">
                    <div class="flex flex-wrap gap-1">
                        <VideoInfo :data="record.jobResult?.Prepare" />
                    </div>
                    <div class="mt-2">
                        <VideoKeepPartParamView :data="record.modelConfig" />
                    </div>
                </TaskJobResultStepView>
            </div>
        </div>
        <div class="mt-3 flex">
            <div class="w-24 flex-shrink-0">
                <div class="inline-block text-center">
                    <icon-tag />
                    {{ $t("app.configSegments") }}
                </div>
            </div>
            <div class="flex-grow pt-1">
                <TaskJobResultStepView :record="record" step="Config">
                    <div
                        class="mb-1"
                        v-if="record.jobResult?.Config?.times?.length"
                    >
                        <div class="bg-gray-100 rounded-lg p-2">
                            <div
                                v-for="(time, index) in record.jobResult?.Config
                                    ?.times"
                                :key="index"
                                class="mb-1 flex last:mb-0"
                            >
                                <div class="w-48 font-mono text-xs">
                                    {{ TimeUtil.msToTime(time.startMs) }} -
                                    {{ TimeUtil.msToTime(time.endMs) }}
                                </div>
                            </div>
                        </div>
                    </div>
                    <template #successPending>
                        <div class="mb-1">
                            <a-button
                                type="primary"
                                @click="doTimeSelectorShow"
                            >
                                <template #icon>
                                    <icon-pen />
                                </template>
                                {{ $t("app.manualSelectSegments") }}
                            </a-button>
                        </div>
                    </template>
                </TaskJobResultStepView>
            </div>
        </div>
        <div class="mt-3 flex">
            <div class="w-24 flex-shrink-0">
                <div class="inline-block text-center">
                    <icon-video-camera />
                    {{ $t("app.renderVideo") }}
                </div>
            </div>
            <TaskJobResultStepView :record="record" step="Render">
                <div>
                    <VideoPreviewBox :url="record.jobResult?.Render.file!" />
                </div>
            </TaskJobResultStepView>
        </div>
        <div class="pt-4 flex items-center">
            <div class="text-gray-400 text-xs mr-2">#{{ record.id }}</div>
            <div class="text-gray-400 flex-grow">
                <timeago :datetime="record['createdAt'] * 1000" />
            </div>
            <div class="">
                <a-button
                    v-if="record.jobResult?.step === 'Config'"
                    size="small"
                    type="primary"
                    @click="doTimeSelectorShow"
                >
                    <template #icon>
                        <icon-edit />
                    </template>
                    {{ $t("app.selectSegments") }}
                </a-button>
                <TaskContinueAction
                    v-if="record.status === 'pause'"
                    :record="record"
                    @update="onRefresh"
                />
                <TaskRetryAction :record="record" @update="onRefresh" />
                <TaskCancelAction :record="record" />
                <TaskDownloadAction :record="record" size="small" />
                <TaskDeleteAction
                    :record="record"
                    size="small"
                    @deleted="onRefresh"
                />
            </div>
        </div>
    </div>
    <VideoEditorTimeRangeListSelectorDialog
        ref="videoEditorTimeRangeListSelectorDialog"
        @save="onSave"
    />
</template>
