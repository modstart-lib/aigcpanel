<script setup lang="ts">
import { testActionSet, testActionUnset } from "@/utils/test";
import { onMounted, onUnmounted, ref } from "vue";
import { t } from "../../../../lang";
import { Dialog } from "../../../../lib/dialog";
import { PermissionService } from "../../../../service/PermissionService";
import { TaskRecord, TaskService } from "../../../../service/TaskService";
import GeneralComfyUIForm from "./GeneralComfyUIForm.vue";

const emit = defineEmits<{
    submitted: [];
}>();

const generalComfyUIForm = ref<InstanceType<typeof GeneralComfyUIForm>>();

onMounted(() => {
    
});

onUnmounted(() => {
    
});

const doSubmit = async () => {
    if (isSubmitting.value) return;
    isSubmitting.value = true;
    try {
        const value = await generalComfyUIForm.value?.getValue();
        if (!value) {
            return;
        }
        const record: TaskRecord = {
            biz: "GeneralComfyUI",
            title:
                (value.param?.comfyuiName || t("general.comfyui.title")) +
                t("general.taskSuffix"),
            serverName: value.serverName,
            serverTitle: value.serverTitle,
            serverVersion: value.serverVersion,
            modelConfig: {
                type: value.type,
                serverKey: value.serverKey,
                param: value.param,
            },
            param: {},
        };
        if (!(await PermissionService.checkForTask(value.type, record))) {
            return;
        }
        const id = await TaskService.submit(record);
        emit("submitted");
        Dialog.tipSuccess(t("general.submitted"));
        return id;
    } finally {
        isSubmitting.value = false;
    }
};

const isSubmitting = ref(false);
</script>

<template>
    <div class="rounded-xl shadow border p-4">
        <GeneralComfyUIForm ref="generalComfyUIForm" />
        <div class="flex">
            <a-button
                class="mr-2"
                type="primary"
                @click="doSubmit"
                :loading="isSubmitting"
            >
                <i-mdi-send class="mr-2" />
                {{ t("general.submit") }}
            </a-button>
        </div>
    </div>
</template>
