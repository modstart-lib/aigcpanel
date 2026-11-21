<script setup lang="ts">
import { ref } from "vue";
import TaskCancelAction from "../../../../components/Server/TaskCancelAction.vue";
import TaskContinueAction from "../../../../components/Server/TaskContinueAction.vue";
import TaskRetryAction from "../../../../components/Server/TaskRetryAction.vue";
import TaskDeleteAction from "../../../../components/Server/TaskDeleteAction.vue";
import TaskDownloadAction from "../../../../components/Server/TaskDownloadAction.vue";
import TaskDuration from "../../../../components/Server/TaskDuration.vue";
import TaskPercent from "../../../../components/Server/TaskPercent.vue";
import TaskTitleField from "../../../../components/Server/TaskTitleField.vue";
import TaskBizStatus from "../../../../components/common/TaskBizStatus.vue";
import TaskJobResultStepView from "../../../../components/common/TaskJobResultStepView.vue";
import VideoPreviewBox from "../../../../components/common/VideoPreviewBox.vue";
import { TimeUtil } from "../../../../lib/util";
import VideoEditorRectListSelectorDialog, {
    VideoEditorRectRecord,
} from "../../../../module/VideoEditor/VideoEditorRectListSelectorDialog.vue";
import { TaskRecord, TaskService } from "../../../../service/TaskService";
import { useTaskStore } from "../../../../store/modules/task";
import VideoInfo from "../../common/VideoInfo.vue";
import { VideoZoomJobResultType, VideoZoomModelConfigType } from "../type";

const taskStore = useTaskStore();
const props = defineProps<{
    record: TaskRecord<VideoZoomModelConfigType, VideoZoomJobResultType>;
    dialog: boolean;
    onRefresh: () => void;
}>();

const videoEditorRectListSelectorDialog = ref<InstanceType<
    typeof VideoEditorRectListSelectorDialog
> | null>(null);

const onSave = async (times: VideoEditorRectRecord[]) => {
    // console.log('onSave', JSON.stringify(times, null, 2));
    await TaskService.update(props.record.id!, {
        statusMsg: "",
        jobResult: {
            step: "Render",
            Config: {
                times,
            },
        } as Partial<VideoZoomJobResultType>,
    });
    await taskStore.dispatch("VideoZoom", props.record.id + "");
    props.onRefresh();
};

const doRenderConfirm = async () => {
    await TaskService.update(props.record.id!, {
        statusMsg: "",
        jobResult: {
            step: "End",
            RenderConfirm: {
                status: "success",
            },
        },
    });
    await taskStore.dispatch("VideoZoom", props.record.id + "");
    props.onRefresh();
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
            <TaskPercent
                v-if="record.status === 'running'"
                :percent="record.result.percent"
            />
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
                    {{ $t("common.parseVideo") }}
                </div>
            </div>
            <div class="flex-grow pt-1">
                <TaskJobResultStepView :record="record" step="Prepare">
                    <div class="flex flex-wrap gap-1">
                        <VideoInfo :data="record.jobResult?.Prepare" />
                    </div>
                </TaskJobResultStepView>
            </div>
        </div>
        <div class="mt-3 flex">
            <div class="w-24 flex-shrink-0">
                <div class="inline-block text-center">
                    <icon-tag />
                    {{ $t("common.zoomMark") }}
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
                                <div class="text-xs text-gray-500">
                                    {{ $t("common.position") }}：X:
                                    {{ time.x }} Y: {{ time.y }}
                                    {{ $t("common.width") }}: {{ time.width }}
                                    {{ $t("common.height") }}: {{ time.height }}
                                </div>
                            </div>
                        </div>
                    </div>
                    <template #successPending>
                        <div class="mb-1">
                            <a-button
                                type="primary"
                                @click="
                                    videoEditorRectListSelectorDialog?.show(
                                        record.modelConfig?.video!,
                                        record.jobResult?.Config?.times || [],
                                    )
                                "
                            >
                                <template #icon>
                                    <icon-pen />
                                </template>
                                {{ $t("common.manualSetTimeNode") }}
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
                    {{ $t("common.videoSynthesis") }}
                </div>
            </div>
            <TaskJobResultStepView :record="record" step="Render">
                <div>
                    <VideoPreviewBox :url="record.jobResult?.Render.file!" />
                </div>
                <div class="mt-1 flex gap-2">
                    <a-button
                        v-if="
                            record.jobResult?.RenderConfirm?.status ===
                            'pending'
                        "
                        type="primary"
                        @click="doRenderConfirm"
                    >
                        <template #icon>
                            <icon-check />
                        </template>
                        {{ $t("common.confirmDone") }}
                    </a-button>
                </div>
            </TaskJobResultStepView>
        </div>
        <div class="pt-4 flex items-center">
            <div class="text-gray-400 text-xs mr-2">#{{ record.id }}</div>
            <div class="text-gray-400 flex-grow">
                <timeago :datetime="record['createdAt'] * 1000" />
            </div>
            <div class="">
                <TaskDownloadAction :record="record" />
                <TaskDeleteAction
                    v-if="!dialog"
                    :record="record"
                    @update="onRefresh"
                />
                <TaskContinueAction :record="record" @update="onRefresh" />
                <TaskRetryAction :record="record" @update="onRefresh" />
                <TaskCancelAction :record="record" />
            </div>
        </div>
    </div>
    <VideoEditorRectListSelectorDialog
        ref="videoEditorRectListSelectorDialog"
        :save-title="$t('common.saveAndContinue')"
        @save="onSave"
    />
</template>
