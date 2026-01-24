<script setup lang="ts">
import {onMounted, ref} from "vue";
import AudioPlayer from "../../components/common/AudioPlayer.vue";
import {useCheckAll} from "../../components/common/check-all";
import TaskBizStatus from "../../components/common/TaskBizStatus.vue";
import VideoPlayer from "../../components/common/VideoPlayer.vue";
import ServerTaskResultParam from "../../components/Server/ServerTaskResultParam.vue";
import TaskBatchDeleteAction from "../../components/Server/TaskBatchDeleteAction.vue";
import TaskBatchDownloadAction from "../../components/Server/TaskBatchDownloadAction.vue";
import TaskCancelAction from "../../components/Server/TaskCancelAction.vue";
import TaskDeleteAction from "../../components/Server/TaskDeleteAction.vue";
import TaskDownloadAction from "../../components/Server/TaskDownloadAction.vue";
import TaskDuration from "../../components/Server/TaskDuration.vue";
import TaskTitleField from "../../components/Server/TaskTitleField.vue";
import {TaskRecord, TaskService} from "../../service/TaskService";
import {usePaginate} from "../../hooks/paginate";
import {useTaskChangeRefresh} from "../../hooks/task";
import VideoGenCreate from "./components/VideoGenCreate.vue";
import VideoGenFormViewBody from "./components/VideoGenFormViewBody.vue";
import ServerNameVersion from "../../components/Server/ServerNameVersion.vue";
import TextTruncateView from "../../components/TextTruncateView.vue";

const videoGenCreate = ref<InstanceType<typeof VideoGenCreate> | null>(null);

const {page, records, recordsForPage} = usePaginate<TaskRecord>();

const {mergeCheck, isIndeterminate, isAllChecked, onCheckAll, checkRecords} = useCheckAll({
    records: recordsForPage,
});

useTaskChangeRefresh("VideoGen", () => {
    setTimeout(doRefresh, 1000);
});

onMounted(() => {
    doRefresh();
});

const doRefresh = async () => {
    records.value = mergeCheck(await TaskService.list("VideoGen"));
};
</script>

<template>
    <div class="p-5">
        <div class="mb-4 flex items-center">
            <div class="flex-grow flex items-end">
                <div class="text-3xl font-bold">{{ $t("avatar.synthesis") }}</div>
                <div class="text-gray-400 ml-3">{{ $t("intro.lipSync") }}</div>
            </div>
            <div class="flex items-center">
                <a-tooltip v-if="0" :content="$t('common.clearHistory')" position="right" mini>
                    <a-button class="ml-1">
                        <template #icon>
                            <icon-delete/>
                        </template>
                    </a-button>
                </a-tooltip>
            </div>
        </div>
        <div>
            <VideoGenCreate ref="videoGenCreate" @submitted="doRefresh"/>
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
                        <div class="mt-3 flex gap-1">
                            <ServerNameVersion :record="r"/>
                            <VideoGenFormViewBody :data="r.modelConfig"/>
                            <ServerTaskResultParam :record="r as any"/>
                        </div>
                        <div class="pt-2 flex">
                            <div class="flex-grow">
                                <div v-if="r.modelConfig.soundType === 'soundGenerate'">
                                    <div class="mb-2">
                                        <a-tag class="rounded-lg">
                                            <i class="iconfont icon-sound w-5"></i>
                                            {{ $t("voice.synthesis") }}
                                        </a-tag>
                                    </div>
                                    <div class="bg-gray-100 rounded-lg p-2 mb-3">
                                        <TextTruncateView :text="r.modelConfig.soundGenerateText"/>
                                    </div>
                                </div>
                                <div v-if="r.modelConfig.soundType === 'soundCustom'">
                                    <div class="mb-2">
                                        <a-tag class="rounded-lg">
                                            <icon-file/>
                                            {{ $t("common.localFile") }}
                                        </a-tag>
                                    </div>
                                    <div class="flex-grow">
                                        <AudioPlayer :url="`file://${r.modelConfig.soundCustomFile}`"/>
                                    </div>
                                </div>
                            </div>
                            <div class="flex-shrink-0 ml-8">
                                <div class="p-2 rounded shadow bg-gray-300" v-if="r.result.url">
                                    <div class="w-48 h-48">
                                        <VideoPlayer :url="'file://' + r.result.url"/>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="pt-4 flex items-center">
                            <div class="text-gray-400 flex-grow">
                                <timeago :datetime="r['createdAt'] * 1000"/>
                            </div>
                            <div class="">
                                <TaskDownloadAction :record="r"/>
                                <TaskDeleteAction :record="r" @update="doRefresh"/>
                                <TaskCancelAction :record="r"/>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <m-empty v-else/>
        </div>
    </div>
</template>
