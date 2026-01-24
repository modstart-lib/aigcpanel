<script setup lang="ts">
import { computed, ref } from "vue";
import { t } from "../../../lang";
import { Dialog } from "../../../lib/dialog";
import { TaskRecord, TaskService } from "../../../service/TaskService";
import { TaskChangeType, useTaskStore } from "../../../store/modules/task";

const props = defineProps<{
    title: string
}>();

const record = ref<TaskRecord | null>(null);
const loading = ref(false);
const currentId = ref<number | null>(null);
const visible = ref(false);
const taskStore = useTaskStore();

const nodeItems: any = import.meta.glob("../*/components/*Item.vue", {eager: true});
const items: Record<string, any> = {};
for (const path in nodeItems) {
    const match = path.match(/\.\.\/(.*?)\/components\//);
    if (match) {
        const moduleName = match[1];
        items[moduleName] = nodeItems[path].default;
    }
}
const itemComponent = computed(() => {
    if (record.value) {
        return items[record.value.biz] || null;
    }
    return null;
});

const doLoad = async () => {
    loading.value = true;
    try {
        record.value = await TaskService.get(currentId.value!);
        if (!record.value) {
            Dialog.tipError(t("error.recordNotFound"));
            return;
        }
    } catch (error) {
        Dialog.tipError(t("error.loadRecordFailed", {error: '' + error}));
    } finally {
        loading.value = false;
    }
};

const onTaskChangeCallback = (
    bizId: string,
    type: TaskChangeType
) => {
    if (bizId + '' === `${currentId.value}`) {
        doLoad();
    }
}

const onShow = () => {
    if (record.value) {
        taskStore.onChange(record.value.biz, onTaskChangeCallback);
    }
};

const onClose = () => {
    if (record.value) {
        taskStore.offChange(record.value.biz, onTaskChangeCallback);
    }
};

defineExpose({
    show: async (id: number) => {
        currentId.value = id;
        visible.value = true;
        await doLoad();
        onShow();
    },
});
</script>

<template>
    <a-modal
        v-model:visible="visible"
        width="90vw"
        :footer="false"
        @close="onClose"
        title-align="start">
        <template #title>
            <div class="font-bold">
                {{ props.title || t("common.viewRecord") }}
            </div>
        </template>
        <div v-if="visible" class="h-[calc(100vh-10rem)] -my-6 -mx-4 p-3 overflow-y-auto">
            <div v-if="loading&&!record" class="flex justify-center items-center p-8">
                <icon-refresh spin class="mr-2"/>
                {{ t("common.loadingDots") }}
            </div>
            <div v-else-if="record">
                <component
                    v-if="itemComponent"
                    :is="itemComponent"
                    :record="record"
                    :dialog="true"
                    :on-refresh="doLoad"
                />
            </div>
            <div v-else class="text-center p-8 text-gray-400">
                未找到记录
            </div>
        </div>
    </a-modal>
</template>
