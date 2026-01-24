<script setup lang="ts">
import { computed, ref } from "vue";
import ServerNameVersion from "../../../../components/Server/ServerNameVersion.vue";
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
import VideoPreviewBox from "../../../../components/common/VideoPreviewBox.vue";
import { TaskRecord, TaskService } from "../../../../service/TaskService";
import { useTaskStore } from "../../../../store/modules/task";
import SoundAsrRecordsEditDialog from "../../../Sound/components/SoundAsrRecordsEditDialog.vue";
import SoundGenerateFormViewBody from "../../../Sound/components/SoundGenerateFormViewBody.vue";
import { SoundReplaceJobResultType, SoundReplaceModelConfigType } from "../type";

const taskStore = useTaskStore()
const props = defineProps<{
    record: TaskRecord<SoundReplaceModelConfigType, SoundReplaceJobResultType>;
    dialog: boolean;
    onRefresh: () => void;
}>();

const soundAsrRecordsEditDialog = ref<InstanceType<typeof SoundAsrRecordsEditDialog> | null>(null);
const soundAsrText = computed(() => {
    if (props.record.jobResult?.SoundAsr && props.record.jobResult?.SoundAsr.records) {
        return props.record.jobResult?.SoundAsr.records.map(item => item.text).join(" ");
    }
    return "";
});
const confirmText = computed(() => {
    if (props.record.jobResult?.Confirm && props.record.jobResult?.Confirm.records) {
        return props.record.jobResult?.Confirm.records.map(item => item.text).join(" ");
    }
    return "";
});

const onConfirm = async (taskId: number, records: any[]) => {
    await TaskService.update(taskId, {
        statusMsg: "",
        jobResult: {
            step: "SoundGenerate",
            Confirm: {records,},
            SoundGenerate: {records: []},
        },
    });
    await taskStore.dispatch("SoundReplace", taskId + "");
    props.onRefresh();
};

const doCombineConfirm = async () => {
    await TaskService.update(props.record.id!, {
        statusMsg: "",
        jobResult: {
            step: "End",
            CombineConfirm: {
                status: "success",
            }
        },
    });
    await taskStore.dispatch("SoundReplace", props.record.id + "");
    props.onRefresh();
};

const doDeleteConfirmRecordItem = async (index: number) => {
    const record = await TaskService.get(props.record.id!);
    record?.jobResult?.Confirm?.records?.splice(index, 1);
    record?.jobResult?.SoundGenerate?.records?.splice(index, 1);
    await TaskService.update(props.record.id!, {
        jobResult: {
            Confirm: {records: record?.jobResult?.Confirm?.records},
            SoundGenerate: {records: record?.jobResult?.SoundGenerate?.records},
        },
    });
    props.onRefresh();
};

const doSaveConfirmRecordItem = async (index: number, text: string) => {
    const record = await TaskService.get(props.record.id!);
    console.log('doSaveConfirmRecordItem', JSON.stringify({index, text, jobResult: record?.jobResult}));
    if (record?.jobResult?.Confirm?.records && record?.jobResult?.Confirm?.records[index]) {
        record.jobResult.Confirm.records[index].text = text;
    }
    if (record?.jobResult?.SoundGenerate?.records && record?.jobResult?.SoundGenerate?.records[index]) {
        record.jobResult.SoundGenerate.records[index].text = text;
        record.jobResult.SoundGenerate.records[index].audio = null;
    }
    await TaskService.update(props.record.id!, {
        jobResult: {
            Confirm: {records: record?.jobResult?.Confirm?.records},
            SoundGenerate: {records: record?.jobResult?.SoundGenerate?.records},
        },
    });
    // console.log('doSaveConfirmRecordItem.end', JSON.stringify({index, text, jobResult: record?.jobResult}));
    props.onRefresh();
};

</script>

<template>
    <div class="rounded-xl shadow border p-4 mb-4 hover:shadow-lg">
        <div class="flex gap-1 items-center">
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
            <TaskDuration :start="record.startTime" :end="record.endTime"/>
            <TaskBizStatus :status="record.status" :status-msg="record.statusMsg"/>
        </div>
        <div class="mt-3 flex">
            <div class="w-24 flex-shrink-0">
                <div class="inline-block text-center">
                    <i class="iconfont icon-sound-prompt"></i>
                    {{ $t("soundReplace.extractAudio") }}
                </div>
            </div>
            <div class="flex-grow pt-1">
                <TaskJobResultStepView :record="record" step="ToAudio">
                    <AudioPlayer :url="record.jobResult?.ToAudio.file" show-wave/>
                </TaskJobResultStepView>
            </div>
        </div>
        <div class="mt-3 flex">
            <div class="w-24 flex-shrink-0">
                <div class="inline-block text-center">
                    <i class="iconfont icon-asr"></i>
                    {{ $t("voice.recognition") }}
                </div>
            </div>
            <div class="flex-grow pt-1">
                <TaskJobResultStepView :record="record" step="SoundAsr">
                    <div class="bg-gray-100 rounded-lg p-2">
                        <TextTruncateView :max-length="40" :text="soundAsrText"/>
                    </div>
                </TaskJobResultStepView>
                <div class="mt-1">
                    <ServerNameVersion :record="record.modelConfig?.soundAsr!"/>
                </div>
            </div>
        </div>
        <div class="mt-3 flex">
            <div class="w-24 flex-shrink-0">
                <div class="inline-block text-center">
                    <icon-ordered-list/>
                    {{ $t("soundReplace.reorderConfirm") }}
                </div>
            </div>
            <div class="flex-grow pt-1">
                <TaskJobResultStepView :record="record" step="Confirm">
                    <div class="mb-1">
                        <div class="bg-gray-100 rounded-lg p-2">
                            <TextTruncateView :max-length="40" :text="confirmText"/>
                        </div>
                    </div>
                    <template #successPending>
                        <div class="mb-1">
                            <a-button
                                type="primary"
                                @click="soundAsrRecordsEditDialog?.edit(
                                    record.id!,
                                    record.jobResult?.Confirm.records!||[],
                                    record.jobResult?.ToAudio.file!,
                                    record.jobResult?.SoundAsr.duration||0
                                    )">
                                <template #icon>
                                    <icon-pen/>
                                </template>
                                {{ $t("soundReplace.manualConfirmText") }}
                            </a-button>
                        </div>
                    </template>
                </TaskJobResultStepView>
            </div>
        </div>
        <div class="mt-3 flex">
            <div class="w-24 flex-shrink-0">
                <div class="inline-block text-center">
                    <i class="iconfont icon-sound"></i>
                    {{ $t("voice.synthesis") }}
                </div>
            </div>
            <div class="flex-grow">
                <TaskJobResultStepView :record="record" step="SoundGenerate">
                    <template #successRunning>
                        <div class="bg-gray-100 rounded-lg p-2">
                            <ItemsLimitedView toggle-biz="SoundReplace"
                                              :toggle-id="record.id!"
                                              :records="record.jobResult?.SoundGenerate?.records||[]">
                                <template #default="{item,index}">
                                    <div class="flex items-start mb-1">
                                        <div class="w-6 flex-shrink-0 -mt-0.5">
                                            <AudioPlayerButton v-if="item.audio" :source="item.audio"/>
                                            <icon-info-circle v-else class="text-gray-400 text-xs"/>
                                        </div>
                                        <div class="w-6 flex-shrink-0 -mt-0.5">
                                            <a-popover :title="$t('soundReplace.modifyText')" placement="right" trigger="click">
                                                <a href="javascript:;">
                                                    <icon-pen-fill class="text-gray-500"/>
                                                </a>
                                                <template #content>
                                                    <a-input
                                                        :default-value="item.text"
                                                        class="w-96"
                                                        size="small"
                                                        :placeholder="$t('hint.inputContent')"
                                                        @keydown.enter.prevent="doSaveConfirmRecordItem(index, $event.target.value)"
                                                    />
                                                </template>
                                            </a-popover>
                                        </div>
                                        <div class="w-6 flex-shrink-0 -mt-0.5">
                                            <a href="javascript:;" @click="doDeleteConfirmRecordItem(index)">
                                                <icon-delete class="text-red-500"/>
                                            </a>
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
                    <i class="iconfont icon-video"></i>
                    {{ $t("soundReplace.videoSynthesis") }}
                </div>
            </div>
            <TaskJobResultStepView :record="record" step="Combine">
                <div>
                    <VideoPreviewBox :url="record.jobResult?.Combine.file!"/>
                </div>
                <div class="mt-1 flex gap-2">
                    <a-button
                        type="primary"
                        @click="soundAsrRecordsEditDialog?.edit(
                                    record.id!,
                                    record.jobResult?.Confirm.records!||[],
                                    record.jobResult?.Combine.file!,
                                    record.jobResult?.SoundAsr.duration||0
                                    )">
                        <template #icon>
                            <icon-pen/>
                        </template>
                        {{ $t("soundReplace.reverifyText") }}
                    </a-button>
                    <a-button
                        v-if="record.jobResult?.CombineConfirm?.status==='pending'"
                        type="primary"
                        @click="doCombineConfirm">
                        <template #icon>
                            <icon-check/>
                        </template>
                        {{ $t("soundReplace.confirmComplete") }}
                    </a-button>
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
                <TaskDownloadAction :record="record" name="srt" :title="$t('download.subtitleFile')">
                    <template #icon>
                        <icon-file/>
                    </template>
                </TaskDownloadAction>
                <TaskDeleteAction
                    v-if="!dialog"
                    :record="record"
                    @update="onRefresh"
                />
                <TaskContinueAction :record="record" @update="onRefresh"/>
            </div>
        </div>
    </div>
    <SoundAsrRecordsEditDialog ref="soundAsrRecordsEditDialog"
                               :sound-generate="record.modelConfig?.soundGenerate!"
                               :save-title="$t('soundReplace.saveAndSynthesize')" @save="onConfirm"/>
</template>
