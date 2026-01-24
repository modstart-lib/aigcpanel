<script setup lang="ts">
import { IconCopy, IconDown, IconDownload, IconEdit } from "@arco-design/web-vue/es/icon";
import { computed, onMounted, ref } from "vue";
import ServerNameVersion from "../../components/Server/ServerNameVersion.vue";
import ServerTaskResultParam from "../../components/Server/ServerTaskResultParam.vue";
import TaskBatchDeleteAction from "../../components/Server/TaskBatchDeleteAction.vue";
import TaskBatchDownloadAction from "../../components/Server/TaskBatchDownloadAction.vue";
import TaskCancelAction from "../../components/Server/TaskCancelAction.vue";
import TaskDeleteAction from "../../components/Server/TaskDeleteAction.vue";
import TaskDuration from "../../components/Server/TaskDuration.vue";
import TaskTitleField from "../../components/Server/TaskTitleField.vue";
import TextTruncateView from "../../components/TextTruncateView.vue";
import TaskBizStatus from "../../components/common/TaskBizStatus.vue";
import { useCheckAll } from "../../components/common/check-all";
import { doCopy } from "../../components/common/util";
import { usePaginate } from "../../hooks/paginate";
import { useTaskChangeRefresh } from "../../hooks/task";
import { t } from "../../lang";
import { Dialog } from "../../lib/dialog";
import { formatSRTTime } from "../../lib/srt";
import { DownloadUtil } from "../../lib/util";
import { TaskRecord, TaskService } from "../../service/TaskService";
import SoundAsrCreate from "./components/SoundAsrCreate.vue";
import SoundAsrRecordsEditDialog from "./components/SoundAsrRecordsEditDialog.vue";

interface AsrRecord {
    start: number;
    end: number;
    text: string;
}

const soundAsrRecordsEditDialog = ref<InstanceType<typeof SoundAsrRecordsEditDialog> | null>(null);

const {page, records, recordsForPage} = usePaginate<TaskRecord>();

useTaskChangeRefresh("SoundAsr", () => {
    doRefresh();
});

const {mergeCheck, isIndeterminate, isAllChecked, onCheckAll, checkRecords} = useCheckAll({
    records: recordsForPage,
});

onMounted(async () => {
    await doRefresh();
});

const doRefresh = async () => {
    const rawRecords = await TaskService.list("SoundAsr");
    const processedRecords = rawRecords.map(record => {
        record.runtime = {
            text: computed(() => {
                if (record.result && record.result.records && Array.isArray(record.result.records)) {
                    return record.result.records.map(r => r.text).join("");
                }
                return "";
            }),
        };
        return record;
    });
    records.value = mergeCheck(processedRecords);
};

const onDownloadResultSubtitle = (record: TaskRecord) => {
    if (record?.result?.records.length) {
        const srtContent = record.result.records
            .map(
                (asrRecord, index) =>
                    `${index + 1}\n${formatSRTTime(asrRecord.start)} --> ${formatSRTTime(asrRecord.end)}\n${
                        asrRecord.text
                    }\n`
            )
            .join("\n");
        DownloadUtil.downloadFile(srtContent, `${record.title || "asr-result"}.srt`);
    }
};
const onEditSave = async (taskId: number, records: AsrRecord[]) => {
    await TaskService.update(taskId, {result: {records}});
    Dialog.tipSuccess(t("common.saveSuccess"));
    await doRefresh();
};
</script>

<template>
    <div class="p-5">
        <div class="mb-4 flex items-center">
            <div class="flex-grow flex items-end">
                <div class="text-3xl font-bold">{{ $t("voice.recognition") }}</div>
                <div class="text-gray-400 ml-3">{{ $t("desc.recognitionEdit") }}</div>
            </div>
        </div>
        <div>
            <SoundAsrCreate @submitted="doRefresh"/>
            <div v-if="records.length > 0">
                <div class="rounded-xl shadow border p-4 mt-4 hover:shadow-lg flex items-center">
                    <div class="flex-grow flex items-center">
                        <div class="mr-3">
                            <a-checkbox
                                :model-value="isAllChecked"
                                :indeterminate="isIndeterminate"
                                @change="onCheckAll"
                            >
                                {{ $t("common.selectAll") }}
                            </a-checkbox>
                        </div>
                        <TaskBatchDeleteAction :records="checkRecords" @update="doRefresh"/>
                        <TaskBatchDownloadAction :records="checkRecords"/>
                    </div>
                    <div>
                        <a-pagination
                            v-model:current="page"
                            :total="records.length"
                            :page-size="10"
                            show-total
                            simple
                        />
                    </div>
                </div>
                <div v-for="r in recordsForPage" :key="r.id">
                    <div class="rounded-xl shadow border p-4 mt-4 hover:shadow-lg">
                        <div class="flex items-center gap-1">
                            <div class="inline-flex items-start bg-blue-100 rounded-full px-2 leading-8 h-8 mr-2">
                                <div class="mr-2 h-8 pt-0.5">
                                    <a-checkbox v-model="r['_check']"/>
                                </div>
                                <div class="">
                                    <TaskTitleField
                                        :record="r"
                                        @title-click="r['_check'] = !r['_check']"
                                        @update="v => (r.title = v)"
                                    />
                                </div>
                            </div>
                            <div class="flex-grow"></div>
                            <TaskDuration :start="r.startTime" :end="r.endTime"/>
                            <TaskBizStatus :status="r.status" :status-msg="r.statusMsg"/>
                        </div>
                        <div class="mt-3 flex gap-1 flex-wrap">
                            <ServerNameVersion :record="r"/>
                            <ServerTaskResultParam :record="r as any"/>
                        </div>

                        <div v-if="r.result && r.runtime?.text" class="mt-3">
                            <div class="bg-gray-100 rounded-lg p-2">
                                <TextTruncateView :text="r.runtime?.text"/>
                            </div>
                        </div>

                        <div class="pt-4 flex items-center">
                            <div class="text-gray-400 flex-grow">
                                <timeago :datetime="r['createdAt'] * 1000"/>
                            </div>
                            <div class="">
                                <a-tooltip v-if="r.result && r.runtime?.text" :content="$t('common.copyText')" mini>
                                    <a-button class="mr-2" @click="doCopy(r.runtime?.text)" :title="$t('soundAsr.copyResult')">
                                        <template #icon>
                                            <icon-copy/>
                                        </template>
                                    </a-button>
                                </a-tooltip>
                                <a-tooltip v-if="r.result && r.runtime?.text" :content="$t('common.download')" mini>
                                    <a-dropdown-button
                                        @click="
                                            DownloadUtil.downloadFile(r.runtime?.text, `${r.title || 'asr-result'}.txt`)
                                        "
                                        class="mr-2"
                                    >
                                        <icon-download/>
                                        <template #icon>
                                            <icon-down/>
                                        </template>
                                        <template #content>
                                            <a-doption
                                                @click="
                                                    DownloadUtil.downloadFile(
                                                        r.runtime?.text,
                                                        `${r.title || 'asr-result'}.txt`
                                                    )
                                                "
                                            >
                                                {{ $t("download.textFile") }}
                                            </a-doption>
                                            <a-doption @click="onDownloadResultSubtitle(r)">
                                                {{ $t("download.subtitleFile") }}
                                            </a-doption>
                                        </template>
                                    </a-dropdown-button>
                                </a-tooltip>
                                <a-tooltip v-if="r.result && r.result.records" :content="$t('common.edit')" mini>
                                    <a-button
                                        class="mr-2"
                                        @click="soundAsrRecordsEditDialog?.edit(r.id as any, r.result.records)"
                                        :title="$t('task.editResult')"
                                    >
                                        <template #icon>
                                            <icon-edit/>
                                        </template>
                                    </a-button>
                                </a-tooltip>
                                <TaskDeleteAction :record="r" @update="doRefresh"/>
                                <TaskCancelAction :record="r"/>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <m-empty v-else :text="$t('empty.noRecognitionTask')"/>
        </div>

        <!-- 编辑弹窗 -->
        <SoundAsrRecordsEditDialog ref="soundAsrRecordsEditDialog" @save="onEditSave"/>
    </div>
</template>
