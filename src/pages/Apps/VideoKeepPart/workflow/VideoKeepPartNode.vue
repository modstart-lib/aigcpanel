<script setup lang="ts">
import { ref } from "vue";
import TaskDialogViewButton from "../../../../components/common/TaskDialogViewButton.vue";
import {
    FunctionCallNodeEmits,
    FunctionCallNodeProps,
    useFunctionCallNode,
} from "../../../../module/Workflow/nodes/FunctionCall/lib";
import VideoKeepPartParamDialog from "../components/VideoKeepPartParamDialog.vue";
import VideoKeepPartParamView from "../components/VideoKeepPartParamView.vue";

const props = defineProps<FunctionCallNodeProps>();
const emit = defineEmits<FunctionCallNodeEmits>();
const { nodeData, nodeRunData, nodeUpdateData } = useFunctionCallNode(
    props,
    emit,
);
const paramDialog = ref<InstanceType<typeof VideoKeepPartParamDialog>>();
</script>

<template>
    <div class="p-2 relative">
        <div>
            <VideoKeepPartParamView :data="nodeData" />
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
    <VideoKeepPartParamDialog ref="paramDialog" @update="nodeUpdateData" />
</template>
