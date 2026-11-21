<script setup lang="ts">
import TaskCancelAction from "../../../../components/Server/TaskCancelAction.vue";
import TaskContinueAction from "../../../../components/Server/TaskContinueAction.vue";
import TaskRetryAction from "../../../../components/Server/TaskRetryAction.vue";
import TaskDeleteAction from "../../../../components/Server/TaskDeleteAction.vue";
import TaskDownloadAction from "../../../../components/Server/TaskDownloadAction.vue";
import TaskDuration from "../../../../components/Server/TaskDuration.vue";
import TaskTitleField from "../../../../components/Server/TaskTitleField.vue";
import AudioPlayer from "../../../../components/common/AudioPlayer.vue";
import TaskBizStatus from "../../../../components/common/TaskBizStatus.vue";
import TaskJobResultStepView from "../../../../components/common/TaskJobResultStepView.vue";
import VideoPlayer from "../../../../components/common/VideoPlayer.vue";
import { TaskRecord } from "../../../../service/TaskService";
import { FfmpegJobResultType, FfmpegModelConfigType } from "../type";

const props = defineProps<{
    record: TaskRecord<FfmpegModelConfigType, FfmpegJobResultType>;
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
        <div class="mt-3 flex items-start">
            <div class="w-24 flex-shrink-0">
                <div class="inline-block text-center">
                    <icon-command />
                    {{ $t("app.prepareFiles") }}
                </div>
            </div>
            <div class="flex-grow">
                <TaskJobResultStepView :record="record" step="Prepare">
                    <div class="flex items-center gap-1 flex-wrap">
                        <a-tag
                            v-for="(v, k) in record.jobResult?.Prepare
                                .inputsMap"
                            :key="k"
                            class="rounded-lg"
                        >
                            {{
                                $t("app.inputFileLabel", {
                                    i: k.replace(/[{}(input)]/g, ""),
                                })
                            }}
                            {{ v }}
                        </a-tag>
                        <a-tag
                            v-for="(v, k) in record.jobResult?.Prepare
                                .outputsMap"
                            :key="k"
                            class="rounded-lg"
                        >
                            {{
                                $t("app.outputFileLabel", {
                                    i: k.replace(/[{}(output)]/g, ""),
                                })
                            }}
                            {{ v }}
                        </a-tag>
                    </div>
                    <div class="mb-2">
                        <pre
                            class="rounded-lg text-xs bg-gray-100 p-1 break-all whitespace-break-spaces leading-5"
                            >{{ $t("app.commandPrefix") }} {{
                                record.jobResult?.Prepare.commands.join(" ")
                            }}</pre>
                    </div>
                </TaskJobResultStepView>
            </div>
        </div>
        <div class="mt-3 flex">
            <div class="w-24 flex-shrink-0">
                <div class="inline-block text-center">
                    <icon-command />
                    {{ $t("app.stepExecute") }}
                </div>
            </div>
            <TaskJobResultStepView :record="record" step="Execute">
                <div>
                    <div
                        v-for="(v, k) in record.jobResult?.Prepare.outputsMap"
                        class="mb-2"
                    >
                        <div v-if="v.match(/\.(mp3|wav)$/)">
                            <AudioPlayer :url="v" />
                        </div>
                        <div v-else-if="v.match(/\.(mp4)$/)">
                            <VideoPlayer :url="v" />
                        </div>
                    </div>
                </div>
            </TaskJobResultStepView>
        </div>
        <div class="pt-4 flex items-center">
            <div class="text-gray-400 text-xs mr-2">#{{ record.id }}</div>
            <div class="text-gray-400 flex-grow">
                <timeago :datetime="record['createdAt'] * 1000" />
            </div>
            <div class="">
                <TaskDownloadAction :record="record" name="output1" />
                <TaskDownloadAction :record="record" name="output2" />
                <TaskDownloadAction :record="record" name="output3" />
                <TaskDownloadAction :record="record" name="output4" />
                <TaskDownloadAction :record="record" name="output5" />
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
