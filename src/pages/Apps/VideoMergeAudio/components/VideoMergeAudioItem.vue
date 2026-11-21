<script setup lang="ts">
import TaskCancelAction from "../../../../components/Server/TaskCancelAction.vue";
import TaskContinueAction from "../../../../components/Server/TaskContinueAction.vue";
import TaskRetryAction from "../../../../components/Server/TaskRetryAction.vue";
import TaskDeleteAction from "../../../../components/Server/TaskDeleteAction.vue";
import TaskDownloadAction from "../../../../components/Server/TaskDownloadAction.vue";
import TaskDuration from "../../../../components/Server/TaskDuration.vue";
import TaskTitleField from "../../../../components/Server/TaskTitleField.vue";
import TaskBizStatus from "../../../../components/common/TaskBizStatus.vue";
import TaskJobResultStepView from "../../../../components/common/TaskJobResultStepView.vue";
import VideoPreviewBox from "../../../../components/common/VideoPreviewBox.vue";
import { TaskRecord } from "../../../../service/TaskService";
import AudioInfo from "../../common/AudioInfo.vue";
import VideoInfo from "../../common/VideoInfo.vue";
import {
    VideoMergeAudioJobResultType,
    VideoMergeAudioModelConfigType,
} from "../type";

const props = defineProps<{
    record: TaskRecord<
        VideoMergeAudioModelConfigType,
        VideoMergeAudioJobResultType
    >;
    dialog: boolean;
    onRefresh: () => void;
}>();
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
                    <icon-video-camera />
                    {{ $t("common.parseVideo") }}
                </div>
            </div>
            <div class="flex-grow">
                <TaskJobResultStepView :record="record" step="Prepare">
                    <div class="flex flex-wrap gap-2 mb-2">
                        <VideoInfo :data="record.jobResult?.Prepare!" />
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <AudioInfo :data="record.jobResult?.Prepare!" />
                    </div>
                </TaskJobResultStepView>
            </div>
        </div>
        <div class="mt-3 flex items-center">
            <div class="w-24 flex-shrink-0">
                <div class="inline-block text-center">
                    <icon-sound />
                    {{ $t("common.volume") }}{{ $t("common.setting") }}
                </div>
            </div>
            <div class="flex-grow">
                <TaskJobResultStepView :record="record" step="Config">
                    <div class="flex items-center gap-1 mb-2">
                        <a-tag class="rounded-lg"
                            >{{ $t("common.volume") }}
                            {{ record.modelConfig?.volume }}%</a-tag
                        >
                        <a-tag class="rounded-lg"
                            >{{ $t("common.loopAudio") }}
                            {{
                                record.modelConfig?.loopAudio
                                    ? $t("common.yes")
                                    : $t("common.no")
                            }}</a-tag
                        >
                    </div>
                </TaskJobResultStepView>
            </div>
        </div>
        <div class="mt-3 flex">
            <div class="w-24 flex-shrink-0">
                <div class="inline-block text-center">
                    <icon-video-camera />
                    {{ $t("common.videoRender") }}
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
</template>
