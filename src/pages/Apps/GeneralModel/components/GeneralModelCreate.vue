<script setup lang="ts">
import { testActionSet, testActionUnset } from "@/utils/test";
import { onMounted, onUnmounted, ref } from "vue";
import { t } from "../../../../lang";
import { Dialog } from "../../../../lib/dialog";
import { PermissionService } from "../../../../service/PermissionService";
import { TaskRecord, TaskService } from "../../../../service/TaskService";
import GeneralModelForm from "./GeneralModelForm.vue";

const emit = defineEmits<{
    submitted: [];
}>();

const generalModelForm = ref<InstanceType<typeof GeneralModelForm>>();

onMounted(() => {
    
});

onUnmounted(() => {
    
});

const doSubmit = async () => {
    if (isSubmitting.value) return;
    isSubmitting.value = true;
    try {
        const value = await generalModelForm.value?.getValue();
        if (!value) {
            return;
        }
        const record: TaskRecord = {
            biz: "GeneralModel",
            title:
                (value.funcName || t("general.model.title")) +
                t("general.taskSuffix"),
            serverName: value.serverName,
            serverTitle: value.serverTitle,
            serverVersion: value.serverVersion,
            modelConfig: {
                type: value.type,
                serverKey: value.serverKey,
                funcName: value.funcName,
                param: value.param,
                resultDef: value.resultDef,
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
        <GeneralModelForm ref="generalModelForm" />
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
