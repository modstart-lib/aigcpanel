<script setup lang="ts">
import { ref } from "vue";
import TaskDialogViewButton from "../../../../components/common/TaskDialogViewButton.vue";
import {
    FunctionCallNodeEmits,
    FunctionCallNodeProps,
    useFunctionCallNode,
} from "../../../../module/Workflow/nodes/FunctionCall/lib";
import ImageToVideoFormView from "../../common/ImageToVideoFormView.vue";
import ImageToVideoParamDialog from "../components/ImageToVideoParamDialog.vue";

const props = defineProps<FunctionCallNodeProps>();
const emit = defineEmits<FunctionCallNodeEmits>();
const { nodeData, nodeRunData, nodeUpdateData } = useFunctionCallNode(
    props,
    emit,
);
const paramDialog = ref<InstanceType<typeof ImageToVideoParamDialog>>();
</script>

<template>
    <div class="p-2 relative">
        <div>
            <ImageToVideoFormView
                v-if="nodeData.imageToVideo"
                :data="nodeData.imageToVideo"
            />
            <div class="flex gap-2 items-center">
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
    <ImageToVideoParamDialog ref="paramDialog" @update="nodeUpdateData" />
</template>
