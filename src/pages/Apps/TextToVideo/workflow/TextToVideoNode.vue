<script setup lang="ts">
import { ref } from "vue";
import TaskDialogViewButton from "../../../../components/common/TaskDialogViewButton.vue";
import {
    FunctionCallNodeEmits,
    FunctionCallNodeProps,
    useFunctionCallNode,
} from "../../../../module/Workflow/nodes/FunctionCall/lib";
import TextToVideoFormView from "../../common/TextToVideoFormView.vue";
import TextToVideoParamDialog from "../components/TextToVideoParamDialog.vue";

const props = defineProps<FunctionCallNodeProps>();
const emit = defineEmits<FunctionCallNodeEmits>();
const { nodeData, nodeRunData, nodeUpdateData } = useFunctionCallNode(
    props,
    emit,
);
const paramDialog = ref<InstanceType<typeof TextToVideoParamDialog>>();
</script>

<template>
    <div class="p-2 relative">
        <div>
            <TextToVideoFormView
                v-if="nodeData.textToVideo"
                :data="nodeData.textToVideo"
            />
            <div class="flex gap-1 items-center">
                <a-button
                    v-if="props.source === 'config'"
                    @click="paramDialog?.show(nodeData)"
                    size="small"
                >
                    <template #icon>
                        <icon-settings />
                    </template>
                    {{ $t("common.setting") }}
                </a-button>
                <TaskDialogViewButton :task-id="nodeRunData.taskId" />
            </div>
        </div>
    </div>
    <TextToVideoParamDialog ref="paramDialog" @update="nodeUpdateData" />
</template>
