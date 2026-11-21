<script setup lang="ts">
import TaskCancelAction from "../../../../components/Server/TaskCancelAction.vue";
import TaskContinueAction from "../../../../components/Server/TaskContinueAction.vue";
import TaskRetryAction from "../../../../components/Server/TaskRetryAction.vue";
import TaskDeleteAction from "../../../../components/Server/TaskDeleteAction.vue";
import TaskDownloadAction from "../../../../components/Server/TaskDownloadAction.vue";
import TaskDuration from "../../../../components/Server/TaskDuration.vue";
import TaskTitleField from "../../../../components/Server/TaskTitleField.vue";
import TextTruncateView from "../../../../components/TextTruncateView.vue";
import VideoPreviewBox from "../../../../components/common/VideoPreviewBox.vue";
import TaskBizStatus from "../../../../components/common/TaskBizStatus.vue";
import TaskJobResultStepView from "../../../../components/common/TaskJobResultStepView.vue";
import { TaskRecord } from "../../../../service/TaskService";
import TextToVideoFormViewBody from "../../common/TextToVideoFormViewBody.vue";
import { TextToVideoJobResultType, TextToVideoModelConfigType } from "../type";

const props = defineProps<{
    record: TaskRecord<TextToVideoModelConfigType, TextToVideoJobResultType>;
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
                    <icon-file />
                    {{ $t("app.processImage") }}
                </div>
            </div>
            <div class="flex-grow pt-1">
                <TaskJobResultStepView :record="record" step="Prepare">
                    <div class="bg-gray-100 rounded-lg p-2">
                        <TextTruncateView :text="record.modelConfig?.prompt!" />
                    </div>
                </TaskJobResultStepView>
            </div>
        </div>
        <div class="mt-3 flex">
            <div class="w-24 flex-shrink-0">
                <div class="inline-block text-center">
                    <icon-file-image />
                    {{ $t("app.imageGeneration") }}
                </div>
            </div>
            <div class="flex-grow">
                <TaskJobResultStepView :record="record" step="Generate">
                    <div>
                        <VideoPreviewBox
                            :url="record.jobResult?.Generate?.video!"
                        />
                    </div>
                </TaskJobResultStepView>
                <div class="mt-1 flex gap-1 flex-wrap">
                    <TextToVideoFormViewBody
                        :data="record.modelConfig?.textToVideo"
                    />
                </div>
            </div>
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
