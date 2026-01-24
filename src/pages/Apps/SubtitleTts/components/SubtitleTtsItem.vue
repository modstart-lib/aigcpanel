<script setup lang="ts">
import { computed } from "vue";
import TaskContinueAction from "../../../../components/Server/TaskContinueAction.vue";
import TaskDeleteAction from "../../../../components/Server/TaskDeleteAction.vue";
import TaskDownloadAction from "../../../../components/Server/TaskDownloadAction.vue";
import TaskDuration from "../../../../components/Server/TaskDuration.vue";
import TaskTitleField from "../../../../components/Server/TaskTitleField.vue";
import TextTruncateView from "../../../../components/TextTruncateView.vue";
import AudioPlayer from "../../../../components/common/AudioPlayer.vue";
import AudioPlayerButton from "../../../../components/common/AudioPlayerButton.vue";
import ItemsLimitedView from "../../../../components/common/ItemsLimitedView.vue";
import TaskBizStatus from "../../../../components/common/TaskBizStatus.vue";
import TaskJobResultStepView from "../../../../components/common/TaskJobResultStepView.vue";
import { TaskRecord } from "../../../../service/TaskService";
import SoundGenerateFormViewBody from "../../../Sound/components/SoundGenerateFormViewBody.vue";
import { SubtitleTtsJobResultType, SubtitleTtsModelConfigType } from "../type";

const props = defineProps<{
    record: TaskRecord<SubtitleTtsModelConfigType, SubtitleTtsJobResultType>;
    dialog: boolean;
    onRefresh: () => void;
}>();

const subtitleText = computed(() => {
    if (props.record.jobResult?.ParseSrt && props.record.jobResult?.ParseSrt.records) {
        return props.record.jobResult?.ParseSrt.records.map(item => item.text).join(" ");
    }
    return "";
});
</script>

<template>
    <div class="rounded-xl shadow border p-4 mb-4 hover:shadow-lg">
        <div class="flex items-center gap-1">
            <div class="inline-flex items-start bg-blue-100 rounded-full px-2 leading-8 h-8 mr-2">
                <div v-if="!dialog" class="mr-2 h-8 pt-0.5">
                    <a-checkbox v-model="record['_check']"/>
                </div>
                <div class="">
                    <TaskTitleField
                        :record="record"
                        :disabled="dialog"
                        @title-click="record['_check'] = !record['_check']"
                        @update="v => (record.title = v)"
                    />
                </div>
            </div>
            <div class="flex-grow"></div>
            <TaskDuration v-if="record.status==='running'" :start="record.startTime" :end="record.endTime"/>
            <TaskBizStatus :status="record.status" :status-msg="record.statusMsg"/>
        </div>
        <div class="mt-3 flex">
            <div class="w-24 flex-shrink-0">
                <div class="inline-block text-center">
                    <icon-file/>
                    {{ $t("subtitleTts.parseSubtitle") }}
                </div>
            </div>
            <div class="flex-grow pt-1">
                <TaskJobResultStepView :record="record" step="ParseSrt">
                    <div class="bg-gray-100 rounded-lg p-2">
                        <TextTruncateView :max-length="40" :text="subtitleText"/>
                    </div>
                </TaskJobResultStepView>
            </div>
        </div>
        <div class="mt-3 flex">
            <div class="w-24 flex-shrink-0">
                <div class="inline-block text-center">
                    <icon-file-audio/>
                    {{ $t("subtitleTts.audioSynthesis") }}
                </div>
            </div>
            <div class="flex-grow">
                <TaskJobResultStepView :record="record" step="SoundGenerate">
                    <template #successRunning>
                        <div class="bg-gray-100 rounded-lg p-2">
                            <ItemsLimitedView toggle-biz="SubtitleTts"
                                              :toggle-id="record.id!"
                                              :records="record.jobResult?.SoundGenerate?.records||[]">
                                <template #default="{item}">
                                    <div class="flex items-start mb-1">
                                        <div class="w-6 flex-shrink-0">
                                            <AudioPlayerButton v-if="item.audio" :source="item.audio"/>
                                            <icon-info-circle v-else class="text-gray-400 text-xs"/>
                                        </div>
                                        <div class="text-xs">{{ item.text }}</div>
                                    </div>
                                </template>
                            </ItemsLimitedView>
                        </div>
                    </template>
                </TaskJobResultStepView>
                <div class="mt-1 flex gap-1">
                    <SoundGenerateFormViewBody :data="record.modelConfig?.soundGenerate!"/>
                </div>
            </div>
        </div>
        <div class="mt-3 flex">
            <div class="w-24 flex-shrink-0">
                <div class="inline-block text-center">
                    <icon-file-audio/>
                    {{ $t("subtitleTts.synthesizedAudio") }}
                </div>
            </div>
            <TaskJobResultStepView :record="record" step="Combine">
                <div class="">
                    <AudioPlayer :url="record.jobResult?.Combine.audio"/>
                </div>
            </TaskJobResultStepView>
        </div>
        <div class="pt-4 flex items-center">
            <div class="text-gray-400 text-xs mr-2">
                #{{ record.id }}
            </div>
            <div class="text-gray-400 flex-grow">
                <timeago :datetime="record['createdAt'] * 1000"/>
            </div>
            <div class="">
                <TaskDownloadAction :record="record"/>
                <TaskDeleteAction
                    v-if="!dialog"
                    :record="record"
                    @update="onRefresh"
                />
                <TaskContinueAction :record="record" @update="onRefresh"/>
            </div>
        </div>
    </div>
</template>
