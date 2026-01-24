<script setup lang="ts">
import LiveServerAvailableNotice from "./components/LiveServerAvailableNotice.vue";
import {computed, onMounted, ref} from "vue";
import {StorageRecord, StorageService} from "../../service/StorageService";
import {Dialog} from "../../lib/dialog";
import {t} from "../../lang";
import {useCheckAll} from "../../components/common/check-all";
import StorageBatchDeleteAction from "../../components/Server/StorageBatchDeleteAction.vue";
import {EventTypes, eventTypeToLabel} from "./util";
import {LiveKnowledgeContentType} from "../../types/Live";

const loading = ref(false);
const records = ref<StorageRecord[]>([]);
const page = ref(1);
const pageSize = ref(100);
const recordsForPage = computed(() => {
    return records.value
        .filter(r => {
            if (filter.value.type) {
                if (r.title !== filter.value.type) {
                    return false;
                }
            }
            return true;
        })
        .slice((page.value - 1) * pageSize.value, page.value * pageSize.value);
});
const {mergeCheck, isIndeterminate, isAllChecked, onCheckAll, checkRecords} = useCheckAll({
    records: recordsForPage,
});

const filter = ref({
    type: "" as LiveKnowledgeContentType["type"],
});

const doRefresh = async () => {
    loading.value = true;
    records.value = await StorageService.list("LiveTalk");
    loading.value = false;
};

const doDelete = async (record: StorageRecord) => {
    await Dialog.confirm(t("common.deleteConfirm"));
    await StorageService.delete(record);
    await doRefresh();
};

const doClear = async () => {
    await Dialog.confirm(t("common.clearConfirm"));
    await StorageService.clear("LiveTalk");
    await doRefresh();
};

onMounted(() => {
    doRefresh();
});
</script>

<template>
    <div class="p-5">
        <div class="mb-4 flex items-center">
            <div class="text-3xl font-bold flex-grow">播报历史</div>
            <div class="flex items-center">
                <a-button class="ml-1" @click="doRefresh()" v-if="!loading && records.length > 0">
                    <template #icon>
                        <icon-refresh />
                    </template>
                    刷新
                </a-button>
                <a-button class="ml-1" @click="doClear()" v-if="!loading && records.length > 0">
                    <template #icon>
                        <icon-delete />
                    </template>
                    清空
                </a-button>
            </div>
        </div>
        <div>
            <LiveServerAvailableNotice />
            <div v-if="loading">
                <m-loading />
            </div>
            <div v-else-if="records.length === 0" class="py-20">
                <m-empty />
            </div>
            <div v-else-if="records.length > 0" class="mb-3">
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
                        <StorageBatchDeleteAction :records="checkRecords" @update="doRefresh" />
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
            </div>
            <div v-if="records.length > 0 && recordsForPage.length === 0" class="py-20">
                <m-empty />
            </div>
            <div v-for="r in recordsForPage" :key="r.id" class="mb-3">
                <div class="rounded-xl shadow border p-4 hover:shadow-lg">
                    <div class="flex items-center">
                        <div class="inline-flex items-start bg-blue-100 rounded-full px-2 leading-8 h-8 mr-2">
                            <div class="mr-2 h-8 pt-0.5">
                                <a-checkbox v-model="r['_check']" />
                            </div>
                            <div class="">
                                {{ r.title }}
                            </div>
                        </div>
                        <div class="text-gray-400">
                            <timeago :datetime="r['createdAt'] * 1000" />
                        </div>
                        <div class="flex-grow"></div>
                        <div class="flex items-center">
                            <a-button @click="doDelete(r)" class="ml-1" size="mini">
                                <template #icon>
                                    <icon-delete />
                                </template>
                            </a-button>
                        </div>
                    </div>
                    <div class="pt-3">
                        {{ r.content.content }}
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
