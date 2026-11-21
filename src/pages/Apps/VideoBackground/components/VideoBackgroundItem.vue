<script setup lang="ts">
import { computed } from "vue";
import { t } from "../../../../lang";
import TaskBizStatus from "../../../../components/common/TaskBizStatus.vue";
import TaskJobResultStepView from "../../../../components/common/TaskJobResultStepView.vue";
import TaskCancelAction from "../../../../components/Server/TaskCancelAction.vue";
import TaskContinueAction from "../../../../components/Server/TaskContinueAction.vue";
import TaskRetryAction from "../../../../components/Server/TaskRetryAction.vue";
import TaskDeleteAction from "../../../../components/Server/TaskDeleteAction.vue";
import TaskDownloadAction from "../../../../components/Server/TaskDownloadAction.vue";
import TaskDuration from "../../../../components/Server/TaskDuration.vue";
import TaskPercent from "../../../../components/Server/TaskPercent.vue";
import TaskTitleField from "../../../../components/Server/TaskTitleField.vue";
import { TaskRecord } from "../../../../service/TaskService";
import VideoInfo from "../../common/VideoInfo.vue";
import {
    VideoBackgroundJobResultType,
    VideoBackgroundModelConfigType,
} from "../type";
import VideoPreviewBox from "../../../../components/common/VideoPreviewBox.vue";

const props = defineProps<{
    record: TaskRecord<
        VideoBackgroundModelConfigType,
        VideoBackgroundJobResultType
    >;
    dialog: boolean;
    onRefresh: () => void;
}>();

const imageModeMap = {
    cover: "app.modeCover",
    contain: "app.modeContainItem",
};

const imageModeText = computed(() => {
    const mode = props.record.modelConfig?.imageMode;
    return t(imageModeMap[mode as keyof typeof imageModeMap] || mode || "");
});
</script>

<template>
    <div class="rounded-xl shadow border p-4 mb-4 hover:shadow-lg">
        <div class="flex items-center gap-1">
            <div
                class="inline-flex items-start bg-blue-100 rounded-full px-2 leading-8 h-8"
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
                :percent="record.result?.percent!"
            />
            <TaskDuration :start="record.startTime" :end="record.endTime" />
            <TaskBizStatus
                :status="record.status"
                :status-msg="record.statusMsg"
            />
        </div>
        <div class="mt-3 flex items-center">
            <div class="w-24 flex-shrink-0">
                <div class="inline-block text-center">
                    <icon-video-camera />
                    {{ $t("app.parseVideo") }}
                </div>
            </div>
            <div class="flex-grow">
                <TaskJobResultStepView :record="record" step="Prepare">
                    <div
                        v-if="record.jobResult?.Prepare"
                        class="flex flex-wrap gap-1"
                    >
                        <VideoInfo :data="record.jobResult.Prepare" />
                    </div>
                </TaskJobResultStepView>
            </div>
        </div>
        <div class="mt-3 flex items-center">
            <div class="w-24 flex-shrink-0">
                <div class="inline-block text-center">
                    <icon-settings />
                    {{ $t("app.backgroundConfig") }}
                </div>
            </div>
            <div class="flex-grow">
                <div>
                    <div class="flex-grow">
                        <div class="flex items-center gap-1 mb-2 flex-wrap">
                            <a-tag class="rounded-lg">{{
                                imageModeText
                            }}</a-tag>
                            <a-tag class="rounded-lg"
                                >{{ record.modelConfig?.outputWidth }}x{{
                                    record.modelConfig?.outputHeight
                                }}
                            </a-tag>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="mt-3 flex">
            <div class="w-24 flex-shrink-0">
                <div class="inline-block text-center">
                    <icon-video-camera />
                    {{ $t("app.videoRender") }}
                </div>
            </div>
            <TaskJobResultStepView :record="record" step="Render">
                <div v-if="record.jobResult?.Render">
                    <VideoPreviewBox :url="record.jobResult.Render.file!" />
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
