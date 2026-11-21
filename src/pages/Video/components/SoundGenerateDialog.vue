<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import AudioPlayer from "../../../components/common/AudioPlayer.vue";
import { t } from "../../../lang";
import { TaskRecord, TaskService } from "../../../service/TaskService";
import { TaskChangeType, useTaskStore } from "../../../store/modules/task";
import { useCheckAll } from "../../../components/common/check-all";
import { doCopy } from "../../../components/common/util";
import TaskDuration from "../../../components/Server/TaskDuration.vue";
import ServerTaskResultParam from "../../../components/Server/ServerTaskResultParam.vue";
import TaskTitleField from "../../../components/Server/TaskTitleField.vue";
import TaskBizStatus from "../../../components/common/TaskBizStatus.vue";

const visible = ref(false);

const records = ref<TaskRecord[]>([]);
const taskStore = useTaskStore();

const page = ref(1);
const recordsForPage = computed(() => {
    return records.value.slice((page.value - 1) * 10, page.value * 10);
});

const taskChangeCallback = (bizId: string, type: TaskChangeType) => {
    doRefresh();
};

onMounted(async () => {
    await doRefresh();
    taskStore.onChange("SoundGenerate", taskChangeCallback);
});
onBeforeUnmount(() => {
    taskStore.offChange("SoundGenerate", taskChangeCallback);
});

const { mergeCheck, isIndeterminate, isAllChecked, onCheckAll, checkRecords } =
    useCheckAll({
        records: recordsForPage,
    });

const doRefresh = async () => {
    records.value = mergeCheck(
        await TaskService.listByStatus("SoundGenerate", ["success"]),
    );
};

const emit = defineEmits<{
    (e: "select", record: TaskRecord): void;
}>();

const doSelect = (record: TaskRecord) => {
    visible.value = false;
    emit("select", record);
};

const show = () => {
    visible.value = true;
};

const load = async (id: number) => {
    return await TaskService.get(id);
};

defineExpose({
    show,
    load,
});
</script>

<template>
    <a-modal
        v-model:visible="visible"
        width="min(900px, 95vw)"
        :footer="false"
        title-align="start"
    >
        <template #title>
            <div class="flex items-center">
                <div class="font-bold mr-2">
                    {{ $t("voice.select") }}
                </div>
                <div class="flex items-center"></div>
            </div>
        </template>
        <div>
            <div>
                <div
                    class="rounded-xl shadow border p-4 hover:shadow-lg flex items-center"
                >
                    <div class="flex-grow flex items-center">
                        <!--                        <div class="mr-3">-->
                        <!--                            <a-checkbox :model-value="isAllChecked" :indeterminate="isIndeterminate"-->
                        <!--                                        @change="onCheckAll">-->
                        <!--                                {{ $t('common.selectAll') }}-->
                        <!--                            </a-checkbox>-->
                        <!--                        </div>-->
                        <!--                        <TaskBatchDeleteAction :records="checkRecords" @update="doRefresh"/>-->
                        <!--                        <TaskBatchDownloadAction :records="checkRecords"/>-->
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
                    <div
                        class="rounded-xl shadow border p-4 mt-4 hover:shadow-lg"
                    >
                        <div class="flex items-center">
                            <div
                                class="inline-flex items-start bg-blue-100 rounded-full px-2 leading-8 h-8 mr-2"
                            >
                                <!--                                <div class="mr-2 h-8 pt-0.5">-->
                                <!--                                    <a-checkbox v-model="r['_check']"/>-->
                                <!--                                </div>-->
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
                            <div class="ml-1">
                                <TaskDuration
                                    :start="r.startTime"
                                    :end="r.endTime"
                                />
                            </div>
                            <div class="ml-1">
                                <TaskBizStatus
                                    :status="r.status"
                                    :status-msg="r.statusMsg"
                                />
                            </div>
                        </div>
                        <div class="mt-3">
                            <div
                                v-if="r.modelConfig.type === 'SoundTts'"
                                class="inline-block mr-2 bg-gray-100 rounded-lg px-1 leading-6 h-6"
                            >
                                <i-mdi-text-to-speech
                                    class="w-4 h-4 inline-block align-middle"
                                />
                                {{ $t("voice.synthesis") }}
                            </div>
                            <div
                                v-else-if="r.modelConfig.type === 'SoundClone'"
                                class="inline-block mr-2 bg-gray-100 rounded-lg px-1 leading-6 h-6"
                            >
                                <i-mdi-account-voice
                                    class="w-4 h-4 inline-block align-middle"
                                />
                                {{ $t("voice.clone") }}
                            </div>
                            <div
                                class="inline-block mr-2 bg-gray-100 rounded-lg px-1 leading-6 h-6"
                            >
                                <i-mdi-server-outline
                                    class="w-4 h-4 inline-block align-middle mr-1"
                                />
                                {{ r.serverTitle }}
                                v{{ r.serverVersion }}
                            </div>
                            <div
                                v-if="
                                    r.modelConfig.type === 'SoundTts' &&
                                    r.modelConfig?.ttsParam?.speakerTitle
                                "
                                class="inline-block mr-2 bg-gray-100 rounded-lg px-2 leading-6 h-6"
                            >
                                <i-mdi-speaker
                                    class="w-4 h-4 inline-block align-middle mr-1"
                                />
                                {{ r.modelConfig?.ttsParam?.speakerTitle }}
                            </div>
                            <div
                                v-if="
                                    r.modelConfig.type === 'SoundTts' &&
                                    r.param?.ttsParam?.speed
                                "
                                class="inline-block mr-2 bg-blue-100 rounded-lg px-2 leading-6 h-6"
                            >
                                <i-mdi-speedometer
                                    class="w-4 h-4 inline-block align-middle mr-1"
                                />
                                <span class=""
                                    >x{{ r.param?.ttsParam?.speed }}</span
                                >
                            </div>
                            <div
                                v-if="r.modelConfig.type === 'SoundClone'"
                                class="inline-block mr-2 bg-gray-100 rounded-lg px-2 leading-6 h-6"
                            >
                                <i-mdi-comment-text-outline
                                    class="w-4 h-4 inline-block align-middle mr-1"
                                />
                                {{ r.modelConfig.promptTitle }}
                            </div>
                            <div
                                v-if="
                                    r.modelConfig.type === 'SoundClone' &&
                                    r.modelConfig?.cloneParam?.speed
                                "
                                class="inline-block mr-2 bg-gray-100 rounded-lg px-2 leading-6 h-6"
                            >
                                <i-mdi-speedometer
                                    class="w-4 h-4 inline-block align-middle mr-1"
                                />
                                <span class=""
                                    >x{{
                                        r.modelConfig?.cloneParam?.speed
                                    }}</span
                                >
                            </div>
                            <div
                                v-if="
                                    r.modelConfig.type === 'SoundClone' &&
                                    r.modelConfig?.cloneParam?.crossLingual
                                "
                                class="inline-block mr-2 bg-gray-100 rounded-lg px-2 leading-6 h-6"
                            >
                                <i-mdi-web
                                    class="w-4 h-4 inline-block align-middle mr-1"
                                />
                                <span class="">{{
                                    $t("voice.crossLanguage")
                                }}</span>
                            </div>
                            <ServerTaskResultParam :record="r as any" />
                        </div>
                        <a-tooltip
                            :content="$t('common.clickTextToCopy')"
                            position="left"
                            mini
                        >
                            <div
                                class="pt-4 cursor-pointer"
                                @click="doCopy(r.modelConfig.text)"
                            >
                                {{ r.modelConfig.text }}
                            </div>
                        </a-tooltip>
                        <div class="pt-4" v-if="r.result && r.result.url">
                            <AudioPlayer
                                show-wave
                                :url="'file://' + r.result.url"
                            />
                        </div>
                        <div class="pt-4 flex items-center">
                            <div class="text-gray-400 flex-grow">
                                <timeago :datetime="r['createdAt'] * 1000" />
                            </div>
                            <div class="">
                                <a-button @click="doSelect(r)" type="primary">
                                    <template #icon>
                                        <icon-check />
                                    </template>
                                    {{ t("common.select") }}
                                </a-button>
                                <!--                                <TaskDownloadAction :record="r"/>-->
                                <!--                                <TaskDeleteAction :record="r" @update="doRefresh"/>-->
                                <!--                                <TaskCancelAction :record="r"/>-->
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </a-modal>
</template>
