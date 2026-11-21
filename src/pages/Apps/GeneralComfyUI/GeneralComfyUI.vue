<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import ServerNameVersion from "../../../components/Server/ServerNameVersion.vue";
import ServerTaskResultParam from "../../../components/Server/ServerTaskResultParam.vue";
import TaskBatchDeleteAction from "../../../components/Server/TaskBatchDeleteAction.vue";
import TaskBatchDownloadAction from "../../../components/Server/TaskBatchDownloadAction.vue";
import TaskCancelAction from "../../../components/Server/TaskCancelAction.vue";
import TaskDeleteAction from "../../../components/Server/TaskDeleteAction.vue";
import TaskDuration from "../../../components/Server/TaskDuration.vue";
import TaskTitleField from "../../../components/Server/TaskTitleField.vue";
import TaskBizStatus from "../../../components/common/TaskBizStatus.vue";
import { useCheckAll } from "../../../components/common/check-all";
import { usePaginate } from "../../../hooks/paginate";
import { useTaskChangeRefresh } from "../../../hooks/task";
import { TaskRecord, TaskService } from "../../../service/TaskService";
import GeneralResultView from "../../../components/common/GeneralResultView.vue";
import GeneralComfyUICreate from "./components/GeneralComfyUICreate.vue";
import ListerTop from "../../../components/common/ListerTop.vue";
import MEmpty from "../../../components/common/MEmpty.vue";
import PageHeader from "../../../components/PageHeader.vue";
import { t } from "../../../lang";

const serverFilter = ref<string>("");
const { page, records, recordsFilterCount, recordsForPage } =
    usePaginate<TaskRecord>({
        filter: (item) => {
            if (!serverFilter.value) return true;
            return item.serverName === serverFilter.value;
        },
    });

useTaskChangeRefresh("GeneralComfyUI", () => {
    doRefresh();
});

const { mergeCheck, isIndeterminate, isAllChecked, onCheckAll, checkRecords } =
    useCheckAll({
        records: recordsForPage,
    });

onMounted(async () => {
    await doRefresh();
});

const doRefresh = async () => {
    const rawRecords = await TaskService.list("GeneralComfyUI");
    records.value = mergeCheck(rawRecords);
};

// 历史任务中出现过的 ComfyUI 服务（按 serverName 去重）
const serverOptions = computed(() => {
    const map = new Map<string, string>();
    for (const r of records.value) {
        if (r.serverName && !map.has(r.serverName)) {
            map.set(r.serverName, r.serverTitle || r.serverName);
        }
    }
    return Array.from(map.entries()).map(([name, title]) => ({ name, title }));
});
</script>

<template>
    <div class="p-5">
        <PageHeader
            :title="t('general.comfyui.title')"
            :desc="t('general.comfyui.desc')"
        />
        <div>
            <GeneralComfyUICreate @submitted="doRefresh" />
            <ListerTop
                class="mt-4"
                :total="recordsFilterCount"
                @refresh="doRefresh"
            >
                <a-checkbox
                    :model-value="isAllChecked"
                    :indeterminate="isIndeterminate"
                    @change="onCheckAll"
                >
                    {{ $t("common.selectAll") }}
                </a-checkbox>
                <TaskBatchDeleteAction
                    :records="checkRecords"
                    @update="doRefresh"
                />
                <TaskBatchDownloadAction :records="checkRecords" />
                <template #actions>
                    <a-select
                        v-if="serverOptions.length > 1"
                        v-model="serverFilter"
                        :placeholder="t('general.filterComfyUI')"
                        size="small"
                        allow-clear
                        style="min-width: 140px"
                        @change="page = 1"
                    >
                        <a-option value="">{{ t("general.all") }}</a-option>
                        <a-option
                            v-for="s in serverOptions"
                            :key="s.name"
                            :value="s.name"
                        >
                            {{ s.title }}
                        </a-option>
                    </a-select>
                    <a-pagination
                        v-model:current="page"
                        :total="recordsFilterCount"
                        :page-size="10"
                        show-total
                        simple
                    />
                </template>
            </ListerTop>
            <div v-if="recordsFilterCount > 0">
                <div v-for="r in recordsForPage" :key="r.id">
                    <div
                        class="rounded-xl shadow border p-4 mt-4 hover:shadow-lg"
                    >
                        <div class="flex items-center gap-1">
                            <div
                                class="inline-flex items-start bg-blue-100 rounded-full px-2 leading-8 h-8 mr-2"
                            >
                                <div class="mr-2 h-8 pt-0.5">
                                    <a-checkbox v-model="r['_check']" />
                                </div>
                                <div class="">
                                    <TaskTitleField
                                        :record="r"
                                        @title-click="
                                            r['_check'] = !r['_check']
                                        "
                                        @update="(v) => (r.title = v)"
                                    />
                                </div>
                            </div>
                            <div class="flex-grow"></div>
                            <TaskDuration
                                :start="r.startTime"
                                :end="r.endTime"
                            />
                            <TaskBizStatus
                                :status="r.status"
                                :status-msg="r.statusMsg"
                            />
                        </div>
                        <div class="mt-3 flex gap-1 flex-wrap">
                            <ServerNameVersion :record="r" />
                            <ServerTaskResultParam :record="r as any" />
                        </div>

                        <div v-if="r.result" class="mt-2">
                            <GeneralResultView :result="r.result" />
                        </div>

                        <div class="pt-4 flex items-center">
                            <div class="text-gray-400 flex-grow">
                                <timeago :datetime="r['createdAt'] * 1000" />
                            </div>
                            <div class="">
                                <TaskDeleteAction
                                    :record="r"
                                    @update="doRefresh"
                                />
                                <TaskCancelAction :record="r" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <m-empty v-else :text="t('general.noTaskComfyui')" />
        </div>
    </div>
</template>
