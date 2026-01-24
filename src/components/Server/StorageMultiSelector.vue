<script setup lang="ts">
import {StorageRecord, StorageService} from "../../service/StorageService";
import {nextTick, onMounted, ref} from "vue";
import {Dialog} from "../../lib/dialog";
import {t} from "../../lang";

const props = defineProps({
    modelValue: {
        type: Array as () => number[],
        default: () => [],
    },
    biz: {
        type: String,
        required: true,
    },
    limit: {
        type: Number,
        default: -1,
    },
    title: {
        type: String,
        default: "请选择",
    },
    recordFilter: {
        type: Function,
        default: (r: StorageRecord) => true,
    },
    disabled: {
        type: Boolean,
        default: false,
    },
});
const emit = defineEmits<{
    (e: "update:modelValue", value: number[]): void;
}>();
const table = ref<any>(null);
const visible = ref(false);
const records = ref<StorageRecord[]>([]);
const recordsSelect = ref<StorageRecord[]>([]);
const recordIdsSelect = ref<number[]>([]);
const doLoad = async () => {
    records.value = await StorageService.list(props.biz as any);
    if (props.recordFilter) {
        records.value = records.value.filter(props.recordFilter as any);
    }
    nextTick(() => {
        if (props.modelValue) {
            recordsSelect.value = records.value.filter(r => props.modelValue.includes(r.id as number));
        }
        table.value?.select(
            records.value.map(r => r.id),
            false
        );
    });
};
const doShow = () => {
    visible.value = true;
    recordIdsSelect.value = [];
    table.value?.select(
        records.value.map(r => r.id),
        false
    );
};
onMounted(() => {
    doLoad();
});
const doConfirm = () => {
    const ids = recordsSelect.value.map(item => item.id) as number[];
    const idsNew: number[] = [];
    const recordsNew: StorageRecord[] = [];
    for (const r of records.value) {
        if (ids.includes(r.id as number)) {
            continue;
        }
        if (recordIdsSelect.value.includes(r.id as any)) {
            idsNew.push(r.id as number);
            recordsNew.push(r);
        }
    }
    if (props.limit > 0 && ids.length + idsNew.length > props.limit) {
        Dialog.tipError(t(`error.maxSelection`, {count: props.limit}));
        return;
    }
    ids.push(...idsNew);
    recordsSelect.value.push(...recordsNew);
    visible.value = false;
    emit("update:modelValue", ids);
};
const doDelete = (id: number) => {
    const index = recordsSelect.value.findIndex(r => r.id === id);
    if (index !== -1) {
        recordsSelect.value.splice(index, 1);
    }
    const ids = recordsSelect.value.map(item => item.id) as number[];
    emit("update:modelValue", ids);
};
const onSelectChange = (keys: number[]) => {
    recordIdsSelect.value = keys;
};
</script>

<template>
    <div class="">
        <div v-if="recordsSelect.length > 0" class="border pt-2 pl-2 pr-1 pb-1 rounded-lg mb-2">
            <div
                v-for="r in recordsSelect"
                class="inline-flex items-center mr-1 mb-1 bg-gray-100 rounded-full p-1 pl-3"
            >
                <div>
                    {{ r.title }}
                </div>
                <div>
                    <a-button size="mini" shape="round" :disabled="props.disabled" @click="doDelete(r.id as number)">
                        <template #icon>
                            <icon-close />
                        </template>
                    </a-button>
                </div>
            </div>
        </div>
        <div v-if="props.limit < 0 || recordsSelect.length < props.limit">
            <a-button @click="doShow" :disabled="props.disabled">
                <template #icon>
                    <icon-plus />
                </template>
                点击添加
            </a-button>
        </div>
    </div>
    <a-modal v-model:visible="visible" :title="props.title" width="60vw" :destroy-on-close="true">
        <template #footer>
            <a-button @click="visible = false">取消</a-button>
            <a-button type="primary" @click="doConfirm">确定</a-button>
        </template>
        <div class="-mx-4 -my-5">
            <a-table
                ref="table"
                @selection-change="onSelectChange"
                :data="records"
                :row-selection="{type: 'checkbox', showCheckedAll: true, onlyCurrent: false}"
                row-key="id"
                :bordered="false"
                :pagination="false"
                :virtual-list-props="{height: '50vh'}"
                :columns="[{title: '名称', dataIndex: 'title'}]"
            >
            </a-table>
        </div>
    </a-modal>
</template>

<style scoped></style>
