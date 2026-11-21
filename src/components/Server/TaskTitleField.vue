<script setup lang="ts">
import { TaskRecord, TaskService } from "../../service/TaskService";
import InputInlineEditor from "../common/InputInlineEditor.vue";

const props = defineProps({
    record: {
        type: Object as () => TaskRecord,
        required: true,
    },
    disabled: {
        type: Boolean,
        default: false,
    },
});

const emit = defineEmits({
    update: (value: string) => true,
    titleClick: () => true,
});

const onEditTitle = async (value: string) => {
    await TaskService.update(props.record.id as any, {
        title: value,
    });
    emit("update", value);
};

const onTitleClick = () => {
    if (!props.disabled) {
        emit("titleClick");
    }
};
</script>

<template>
    <div class="flex items-center">
        <div
            class="truncate flex-grow min-w-0 max-w-96 cursor-pointer"
            @click="onTitleClick"
        >
            {{ record.title }}
        </div>
        <InputInlineEditor
            v-if="!disabled"
            :value="record.title"
            @change="onEditTitle"
        >
            <a
                class="ml-1 text-gray-400 flex-shrink-0 whitespace-nowrap"
                href="javascript:;"
            >
                <icon-pen />
            </a>
        </InputInlineEditor>
    </div>
</template>

<style scoped></style>
