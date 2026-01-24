<script setup lang="ts">
import { ref } from "vue";
import TaskDialogViewButton from "../../../../components/common/TaskDialogViewButton.vue";
import {
    FunctionCallNodeEmits,
    FunctionCallNodeProps,
    useFunctionCallNode
} from "../../../../module/Workflow/nodes/FunctionCall/lib";
import SoundGenerateFormView from "../../../Sound/components/SoundGenerateFormView.vue";
import SubtitleTtsParamDialog from "../components/SubtitleTtsParamDialog.vue";

const props = defineProps<FunctionCallNodeProps>();
const emit = defineEmits<FunctionCallNodeEmits>();
const {nodeData, nodeRunData, nodeUpdateData} = useFunctionCallNode(props, emit)
const paramDialog = ref<InstanceType<typeof SubtitleTtsParamDialog>>();
</script>

<template>
    <div class="p-2 relative">
        <div>
            <SoundGenerateFormView v-if="nodeData.soundGenerate" :data="nodeData.soundGenerate"/>
            <div class="flex gap-2 items-center">
                <a-button v-if="props.source==='config'" @click="paramDialog?.show(nodeData)" size="small">
                    <template #icon>
                        <icon-settings/>
                    </template>
                    {{ $t("common.setting") }}
                </a-button>
                <TaskDialogViewButton :task-id="nodeRunData.taskId"/>
            </div>
        </div>
    </div>
    <SubtitleTtsParamDialog ref="paramDialog" @update="nodeUpdateData"/>
</template>
