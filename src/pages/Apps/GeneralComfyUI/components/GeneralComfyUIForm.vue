<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import ParamForm from "../../../../components/common/ParamForm.vue";
import ServerSelector from "../../../../components/Server/ServerSelector.vue";
import { t } from "../../../../lang";
import { Dialog } from "../../../../lib/dialog";
import { StorageUtil } from "../../../../lib/storage";
import { useServerStore } from "../../../../store/modules/server";

const serverStore = useServerStore();
const formData = ref({
    serverKey: "",
    comfyuiName: "",
});
const paramForm = ref<InstanceType<typeof ParamForm>>();
const param = ref<any[]>([]);
// 当前 ComfyUI 服务的全部工作流（config() 返回）
const workflows = ref<any[]>([]);

// 仅列出 biz=general 的通用工作流（已归类业务的工作流不在此显示）
const generalWorkflows = computed(() => {
    return workflows.value.filter((w) => w.biz === "general");
});

const currentWorkflow = computed(() => {
    return generalWorkflows.value.find(
        (w) => w.key === formData.value.comfyuiName,
    );
});

const onServerUpdate = async (config: any) => {
    workflows.value = config.workflows || [];
    if (generalWorkflows.value.length > 0) {
        formData.value.comfyuiName = generalWorkflows.value[0].key;
        onWorkflowChange();
    } else {
        formData.value.comfyuiName = "";
        param.value = [];
    }
};

const onWorkflowChange = () => {
    param.value = currentWorkflow.value?.param || [];
    paramForm.value?.setValue({});
};

onMounted(async () => {
    const old = StorageUtil.getObject("GeneralComfyUIForm.formData");
    formData.value.serverKey = old.serverKey || "";
    formData.value.comfyuiName = old.comfyuiName || "";
});

watch(
    () => formData.value,
    async (value) => {
        StorageUtil.set("GeneralComfyUIForm.formData", value);
    },
    {
        deep: true,
    },
);

const getValue = async (): Promise<any | undefined> => {
    const data: any = {};
    data.type = "GeneralComfyUI";
    data.serverKey = formData.value.serverKey;

    const server = await serverStore.getByKey(data.serverKey);
    if (!server) {
        Dialog.tipError(t("general.selectModel"));
        return;
    }
    if (!formData.value.comfyuiName) {
        Dialog.tipError(t("general.selectWorkflowTip"));
        return;
    }

    data.serverName = server.name;
    data.serverTitle = server.title;
    data.serverVersion = server.version;
    // comfyuiName 随参数下发，ComfyUIServer.general 据此加载工作流
    data.param = Object.assign(
        { comfyuiName: formData.value.comfyuiName },
        paramForm.value ? paramForm.value.getValue() : {},
    );

    if (!data.param) {
        Dialog.tipError(t("general.invalidParam"));
        return;
    }

    return data;
};

const setValue = (data: any) => {
    if (data.serverKey !== undefined) {
        formData.value.serverKey = data.serverKey;
    }
    if (data.param?.comfyuiName !== undefined) {
        formData.value.comfyuiName = data.param.comfyuiName;
    }
    if (data.param !== undefined) {
        paramForm.value?.setValue(data.param);
    }
};

defineExpose({
    getValue,
    setValue,
});
</script>

<template>
    <div class="mb-4">
        <div class="font-bold mb-2">
            <div class="inline-block w-5">
                <icon-settings />
            </div>
            {{ t("general.comfyui.config") }}
        </div>
        <div class="flex items-start min-h-8 max-w-lg w-full gap-1">
            <div class="pt-2">
                <a-tooltip :content="t('general.comfyui.title')" mini>
                    <i-mdi-server-outline class="w-4 h-4" />
                </a-tooltip>
            </div>
            <div class="flex-grow flex flex-wrap gap-1">
                <ServerSelector
                    v-model="formData.serverKey"
                    @update="onServerUpdate"
                    functionName="comfyui"
                />
                <a-select
                    v-if="generalWorkflows.length > 0"
                    v-model="formData.comfyuiName"
                    :placeholder="t('general.selectWorkflow')"
                    size="small"
                    class="min-w-48"
                    style="height: 32px"
                    @change="onWorkflowChange"
                >
                    <a-option
                        v-for="w in generalWorkflows"
                        :key="w.key"
                        :value="w.key"
                    >
                        {{ w.title }}
                    </a-option>
                </a-select>
            </div>
        </div>
        <div
            v-if="currentWorkflow && currentWorkflow.description"
            class="text-xs text-gray-400 mt-1 ml-6"
        >
            {{ currentWorkflow.description }}
        </div>
        <div class="flex items-start mt-2" v-if="param.length > 0">
            <div class="pt-3 w-5 flex-shrink-0">
                <a-tooltip :content="$t('model.customParam')" mini>
                    <i-mdi-tune-variant class="w-4 h-4" />
                </a-tooltip>
            </div>
            <div class="flex-grow min-w-0">
                <ParamForm ref="paramForm" :param="param" />
            </div>
        </div>
    </div>
</template>
