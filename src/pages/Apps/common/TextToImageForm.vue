<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import ParamForm from "../../../components/common/ParamForm.vue";
import ServerContentInfoAction from "../../../components/Server/ServerContentInfoAction.vue";
import ServerSelector from "../../../components/Server/ServerSelector.vue";
import { t } from "../../../lang";
import { Dialog } from "../../../lib/dialog";
import { StorageUtil } from "../../../lib/storage";
import { useServerStore } from "../../../store/modules/server";
import { EnumServerStatus } from "../../../types/Server";

const serverStore = useServerStore();
const formData = ref({
    serverKey: "",
});
const paramForm = ref<InstanceType<typeof ParamForm>>();
const param = ref([]);
const modelConfig = ref(null);
const workflows = ref<any[]>([]);
const comfyuiName = ref("");

const applyWorkflowParam = () => {
    const wf = workflows.value.find((w) => w.key === comfyuiName.value);
    param.value = wf ? wf.param || [] : [];
};

const onServerUpdate = async (config: any) => {
    const textToImage = config.functions?.textToImage || {};
    workflows.value = textToImage.workflows || [];
    if (workflows.value.length > 0) {
        // 默认选中第一个工作流（保留已选且仍存在的工作流）
        if (
            !comfyuiName.value ||
            !workflows.value.some((w) => w.key === comfyuiName.value)
        ) {
            comfyuiName.value = workflows.value[0].key;
        }
        applyWorkflowParam();
    } else {
        param.value = textToImage.param || [];
    }
    modelConfig.value = config;
};

watch(comfyuiName, () => {
    applyWorkflowParam();
});

onMounted(async () => {
    const old = StorageUtil.getObject("TextToImageForm.formData");
    formData.value.serverKey = old.serverKey || "";
});

watch(
    () => formData.value,
    async (value) => {
        StorageUtil.set("TextToImageForm.formData", value);
    },
    {
        deep: true,
    },
);

const getValue = async (): Promise<TextToImageParamType | undefined> => {
    const data: any = {};
    data.type = "TextToImage";
    data.serverKey = formData.value.serverKey;

    const server = await serverStore.getByKey(data.serverKey);
    if (!server) {
        Dialog.tipError(t("error.pleaseSelectTextToImageModel"));
        return;
    }
    if (server.status !== EnumServerStatus.RUNNING) {
        Dialog.tipError(t("error.textToImageModelNotStarted"));
        return;
    }

    data.serverName = server.name;
    data.serverTitle = server.title;
    data.serverVersion = server.version;
    data.comfyuiName = comfyuiName.value || "";
    data.param = paramForm.value ? paramForm.value.getValue() : {};

    if (!data.param) {
        Dialog.tipError(t("error.textToImageParamInvalid"));
        return;
    }

    return data;
};

const setValue = (data: Partial<TextToImageParamType>) => {
    if (data.serverKey !== undefined) {
        formData.value.serverKey = data.serverKey;
    }
    if (data.comfyuiName !== undefined) {
        comfyuiName.value = data.comfyuiName;
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
            {{ $t("app.textToImageConfig") }}
        </div>
        <div class="flex items-start min-h-8 max-w-lg w-full gap-1">
            <div class="pt-2">
                <a-tooltip :content="$t('app.textToImageModel')" mini>
                    <i-mdi-server-outline class="w-4 h-4" />
                </a-tooltip>
            </div>
            <div class="flex-grow flex flex-wrap gap-1">
                <div>
                    <ServerSelector
                        v-model="formData.serverKey"
                        @update="onServerUpdate"
                        functionName="textToImage"
                    />
                </div>
                <div class="">
                    <ServerContentInfoAction
                        :config="modelConfig"
                        func="textToImage"
                    />
                </div>
            </div>
        </div>
        <div class="flex items-center mt-2" v-if="workflows.length > 0">
            <div class="mr-1 pt-1">
                <a-tooltip :content="$t('app.textToImageWorkflow')" mini>
                    <i-mdi-image-multiple class="w-4 h-4" />
                </a-tooltip>
            </div>
            <a-select
                v-model="comfyuiName"
                size="small"
                class="min-w-40"
                style="width: auto"
                :placeholder="$t('app.textToImageWorkflow')"
            >
                <a-option v-for="wf in workflows" :key="wf.key" :value="wf.key">
                    {{ wf.title }}
                </a-option>
            </a-select>
        </div>
        <!-- 用户输入信息（提示词等）插入 Server 选择与自定义参数之间 -->
        <div class="flex items-center mt-2">
            <slot />
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
